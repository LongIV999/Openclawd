import type { ModelRef } from "../agents/model-selection.js";
import type { NormalizedUsage } from "../agents/usage.js";
import type { OpenClawConfig } from "../config/config.js";
import { ResponseCache } from "../ai/cache/response-cache.js";
import { CostOptimizedModelSelector } from "../ai/optimizer/model-selector.js";
import { BudgetEnforcer } from "../usage/budget-enforcer.js";
import { UsageDashboard } from "../usage/dashboard.js";
import { UsageTracker } from "../usage/tracker.js";
import { resolveModelCostConfig } from "../utils/usage-format.js";

export type CostOptimizationConfig = {
  enabled: boolean;
  tracker?: {
    enabled?: boolean;
    storage?: "sqlite" | "json";
    path?: string;
  };
  cache?: {
    enabled?: boolean;
    type?: "memory" | "disk";
    maxSize?: number;
    defaultTtl?: number;
  };
  budget?: {
    enabled?: boolean;
    dailyLimit?: number;
    weeklyLimit?: number;
    monthlyLimit?: number;
    alerts?: boolean;
  };
  optimization?: {
    enabled?: boolean;
    costSensitivity?: "low" | "medium" | "high";
    autoModelSelection?: boolean;
  };
};

export class CostOptimizationManager {
  private config: OpenClawConfig;
  private costOptimizationConfig: CostOptimizationConfig;
  private tracker?: UsageTracker;
  private budgetEnforcer?: BudgetEnforcer;
  private responseCache?: ResponseCache;
  private modelSelector?: CostOptimizedModelSelector;
  private dashboard?: UsageDashboard;

  constructor(config: OpenClawConfig, costOptimizationConfig?: CostOptimizationConfig) {
    this.config = config;
    this.costOptimizationConfig = {
      enabled: true,
      ...costOptimizationConfig,
    };

    if (this.costOptimizationConfig.enabled) {
      this.initializeComponents();
    }
  }

  async trackUsage(params: {
    agentId: string;
    sessionId: string;
    provider: string;
    model: string;
    usage: NormalizedUsage;
    taskType?: string;
    duration?: number;
    success?: boolean;
    error?: string;
  }): Promise<void> {
    if (!this.tracker) {
      return;
    }

    const costConfig = resolveModelCostConfig({
      provider: params.provider,
      model: params.model,
      config: this.config,
    });

    await this.tracker.recordUsage({
      agentId: params.agentId,
      sessionId: params.sessionId,
      provider: params.provider,
      model: params.model,
      usage: params.usage,
      cost: costConfig,
      metadata: {
        taskType: params.taskType,
        duration: params.duration,
        success: params.success ?? true,
        error: params.error,
      },
    });
  }

  async checkBudgetConstraints(params: {
    agentId: string;
    provider: string;
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    taskType?: string;
  }): Promise<{ allowed: boolean; reason?: string; alternativeModel?: ModelRef }> {
    if (!this.budgetEnforcer) {
      return { allowed: true };
    }

    const costConfig = resolveModelCostConfig({
      provider: params.provider,
      model: params.model,
      config: this.config,
    });

    if (!costConfig) {
      return { allowed: true };
    }

    const estimatedCost =
      (params.estimatedInputTokens / 1_000_000) * costConfig.input +
      (params.estimatedOutputTokens / 1_000_000) * costConfig.output;

    return await this.budgetEnforcer.checkBudgetUsage({
      agentId: params.agentId,
      estimatedCost,
      config: this.config,
    });
  }

  async getCachedResponse(params: {
    prompt: string;
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ response?: string; usage?: NormalizedUsage; cost?: number } | null> {
    if (!this.responseCache) {
      return null;
    }

    const cacheKey = this.responseCache.generateCacheKey({
      prompt: params.prompt,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    const cached = await this.responseCache.get(cacheKey);
    if (cached) {
      return {
        response: cached.response,
        usage: cached.usage,
        cost: cached.cost,
      };
    }

    return null;
  }

  async cacheResponse(params: {
    prompt: string;
    response: string;
    provider: string;
    model: string;
    usage: NormalizedUsage;
    temperature?: number;
    maxTokens?: number;
    customTtl?: number;
  }): Promise<void> {
    if (!this.responseCache) {
      return;
    }

    const costConfig = resolveModelCostConfig({
      provider: params.provider,
      model: params.model,
      config: this.config,
    });

    const cacheKey = this.responseCache.generateCacheKey({
      prompt: params.prompt,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    await this.responseCache.set({
      key: cacheKey,
      response: params.response,
      usage: params.usage,
      cost: costConfig
        ? ((params.usage.input || 0) * costConfig.input) / 1_000_000 +
          ((params.usage.output || 0) * costConfig.output) / 1_000_000
        : 0,
      ttl: params.customTtl,
    });
  }

  async selectOptimalModel(params: {
    taskType: "text" | "image" | "code" | "reasoning" | "translation" | "summary";
    complexity: "low" | "medium" | "high";
    urgency: "low" | "medium" | "high";
    costSensitivity: "low" | "medium" | "high";
    budgetRemaining?: number;
    contextLength?: number;
    requiresReasoning?: boolean;
    requiresMultimodal?: boolean;
  }): Promise<ModelRef> {
    if (!this.modelSelector) {
      // Fallback to default model selection
      return this.getDefaultModel();
    }

    return await this.modelSelector.selectOptimalModel(params);
  }

  async shouldUpgradeModel(params: {
    currentModel: ModelRef;
    taskComplexity: "low" | "medium" | "high";
    costSensitivity: "low" | "medium" | "high";
    budgetRemaining?: number;
  }): Promise<{ shouldUpgrade: boolean; recommendedModel?: ModelRef }> {
    if (!this.modelSelector) {
      return { shouldUpgrade: false };
    }

    return await this.modelSelector.shouldUpgradeModel(params);
  }

  async getUsageDashboard(agentId?: string): Promise<string | null> {
    if (!this.dashboard) {
      return null;
    }

    const metrics = await this.dashboard.getMetrics(agentId);
    return await this.dashboard.formatMetricsReport(metrics);
  }

  async getCostOptimizationSuggestions(params: {
    agentId?: string;
    period: "day" | "week" | "month";
  }): Promise<Array<{ type: string; description: string; potentialSavings?: number }>> {
    const suggestions: Array<{ type: string; description: string; potentialSavings?: number }> = [];

    if (!this.tracker) {
      return suggestions;
    }

    // Get top expensive models
    const topModels = await this.tracker.getTopCostModels({ period: params.period, limit: 5 });

    for (const model of topModels) {
      // Suggest cheaper alternatives for high-cost models
      if (model.cost > 1.0) {
        // Models costing more than $1 in the period
        const cheaperAlternative = this.findCheaperAlternative(model.model);
        if (cheaperAlternative) {
          suggestions.push({
            type: "model-substitution",
            description: `Consider using ${cheaperAlternative} instead of ${model.provider}/${model.model}`,
            potentialSavings: model.cost * 0.5, // Estimate 50% savings
          });
        }
      }
    }

    // Suggest caching if not enabled
    const estimatedRequests = await this.getEstimatedRequests(params);
    if (!this.responseCache && estimatedRequests > 100) {
      suggestions.push({
        type: "enable-caching",
        description: "Enable response caching to save costs on repeated requests",
        potentialSavings: 0.2, // Estimate 20% savings
      });
    }

    return suggestions;
  }

  private initializeComponents(): void {
    const costOptimization = this.config.models?.costOptimization;

    // Initialize usage tracker
    if (this.costOptimizationConfig.tracker?.enabled ?? true) {
      this.tracker = new UsageTracker({
        enabled: true,
        storage: {
          type: this.costOptimizationConfig.tracker?.storage || "json",
          path: this.costOptimizationConfig.tracker?.path,
        },
      });
    }

    // Initialize budget enforcer
    if (this.costOptimizationConfig.budget?.enabled ?? costOptimization?.budgetLimits) {
      this.budgetEnforcer = new BudgetEnforcer({
        dailyBudget:
          this.costOptimizationConfig.budget?.dailyLimit || costOptimization?.budgetLimits?.daily,
        weeklyBudget:
          this.costOptimizationConfig.budget?.weeklyLimit || costOptimization?.budgetLimits?.weekly,
        monthlyBudget:
          this.costOptimizationConfig.budget?.monthlyLimit ||
          costOptimization?.budgetLimits?.monthly,
        alerts: {
          percentage: this.costOptimizationConfig.budget?.alerts ? 80 : undefined,
        },
      });
    }

    // Initialize response cache
    if (this.costOptimizationConfig.cache?.enabled ?? costOptimization?.caching?.enabled) {
      this.responseCache = new ResponseCache({
        enabled: true,
        storage: {
          type: this.costOptimizationConfig.cache?.type || "memory",
          maxSize: this.costOptimizationConfig.cache?.maxSize || 1000,
        },
        ttl: {
          default: this.costOptimizationConfig.cache?.defaultTtl || 3600,
          perModel: {},
        },
      });
    }

    // Initialize model selector
    if (
      this.costOptimizationConfig.optimization?.enabled ??
      costOptimization?.modelOptimization?.enabled
    ) {
      this.modelSelector = new CostOptimizedModelSelector(this.config);
    }

    // Initialize dashboard
    if (this.tracker) {
      this.dashboard = new UsageDashboard(this.config, this.tracker);
    }
  }

  private getDefaultModel(): ModelRef {
    const defaults = this.config.agents?.defaults;
    const modelConfig = defaults?.model;

    if (typeof modelConfig === "string") {
      // Parse "provider/model" format
      const modelStr = modelConfig as string;
      const [provider, model] = modelStr.includes("/")
        ? modelStr.split("/", 2)
        : ["openai", modelStr];
      return { provider, model };
    } else if (modelConfig && typeof modelConfig === "object" && modelConfig.primary) {
      const primary = modelConfig.primary;
      // Parse "provider/model" format
      const [provider, model] = primary.includes("/") ? primary.split("/", 2) : ["openai", primary];
      return { provider, model };
    }

    return { provider: "openai", model: "gpt-4o-mini" };
  }

  private findCheaperAlternative(currentModel: string): string | null {
    const alternatives: Record<string, string> = {
      "gpt-4o": "gpt-4o-mini",
      "gpt-4-turbo": "gpt-4o-mini",
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022",
    };

    return alternatives[currentModel] || null;
  }

  private async getEstimatedRequests(params: {
    agentId?: string;
    period: "day" | "week" | "month";
  }): Promise<number> {
    if (!this.tracker) {
      return 0;
    }

    const usageHistory = await this.tracker.getUsageHistory(params);
    return usageHistory.reduce((total, period) => total + period.requestCount, 0);
  }
}
