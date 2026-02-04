import type { ModelRef } from "../../agents/model-selection.js";
import type { OpenClawConfig } from "../../config/config.js";

export type TaskComplexity = "low" | "medium" | "high";
export type TaskType = "text" | "image" | "code" | "reasoning" | "translation" | "summary";
export type UrgencyLevel = "low" | "medium" | "high";
export type CostSensitivity = "low" | "medium" | "high";

export type ModelSelectionCriteria = {
  taskType: TaskType;
  complexity: TaskComplexity;
  urgency: UrgencyLevel;
  costSensitivity: CostSensitivity;
  budgetRemaining?: number;
  contextLength?: number;
  requiresReasoning?: boolean;
  requiresMultimodal?: boolean;
};

export type ModelPerformanceProfile = {
  model: string;
  cost: {
    input: number;
    output: number;
  };
  performance: {
    speed: number; // 1-10 (fastest to slowest)
    quality: number; // 1-10 (lowest to highest quality)
    reasoning: number; // 1-10 (no reasoning to excellent reasoning)
  };
  capabilities: {
    text: boolean;
    image: boolean;
    reasoning: boolean;
    code: boolean;
    translation: boolean;
    summary: boolean;
  };
  contextWindow: number;
};

export class CostOptimizedModelSelector {
  private config: OpenClawConfig;
  private modelProfiles: Map<string, ModelPerformanceProfile> = new Map();

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.initializeModelProfiles();
  }

  async selectOptimalModel(criteria: ModelSelectionCriteria): Promise<ModelRef> {
    const availableModels = this.getAvailableModels(criteria);
    const scoredModels = await this.scoreModels(availableModels, criteria);

    // Sort by score (highest first)
    const sortedModels = scoredModels.toSorted((a, b) => b.score - a.score);

    if (sortedModels.length === 0) {
      throw new Error("No suitable models found for the given criteria");
    }

    // Check budget constraints
    const selectedModel = await this.applyBudgetConstraints(sortedModels, criteria);

    return selectedModel;
  }

  async shouldUpgradeModel(params: {
    currentModel: ModelRef;
    taskComplexity: TaskComplexity;
    costSensitivity: CostSensitivity;
    budgetRemaining?: number;
  }): Promise<{ shouldUpgrade: boolean; recommendedModel?: ModelRef }> {
    const currentProfile = this.modelProfiles.get(params.currentModel.model);
    if (!currentProfile) {
      return { shouldUpgrade: false };
    }

    // High complexity tasks might need better models
    if (params.taskComplexity === "high" && currentProfile.performance.quality < 7) {
      const betterModels = this.findBetterModels(currentProfile, {
        taskType: "text",
        complexity: params.taskComplexity,
        urgency: "medium",
        costSensitivity: params.costSensitivity,
        budgetRemaining: params.budgetRemaining,
      });

      if (betterModels.length > 0) {
        const canAfford = await this.checkAffordability(betterModels[0], params.budgetRemaining);
        if (canAfford) {
          return {
            shouldUpgrade: true,
            recommendedModel: betterModels[0],
          };
        }
      }
    }

    return { shouldUpgrade: false };
  }

  getModelCostEstimate(model: string, inputTokens: number, outputTokens: number): number {
    const profile = this.modelProfiles.get(model);
    if (!profile) {
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * profile.cost.input;
    const outputCost = (outputTokens / 1_000_000) * profile.cost.output;

    return inputCost + outputCost;
  }

  private initializeModelProfiles(): void {
    // Claude models
    this.modelProfiles.set("claude-3-5-sonnet-20241022", {
      model: "claude-3-5-sonnet-20241022",
      cost: { input: 3.0, output: 15.0 },
      performance: { speed: 6, quality: 9, reasoning: 8 },
      capabilities: {
        text: true,
        image: true,
        reasoning: true,
        code: true,
        translation: true,
        summary: true,
      },
      contextWindow: 200000,
    });

    this.modelProfiles.set("claude-3-5-haiku-20241022", {
      model: "claude-3-5-haiku-20241022",
      cost: { input: 0.8, output: 4.0 },
      performance: { speed: 8, quality: 7, reasoning: 6 },
      capabilities: {
        text: true,
        image: true,
        reasoning: false,
        code: true,
        translation: true,
        summary: true,
      },
      contextWindow: 200000,
    });

    // OpenAI models
    this.modelProfiles.set("gpt-4o", {
      model: "gpt-4o",
      cost: { input: 5.0, output: 15.0 },
      performance: { speed: 7, quality: 9, reasoning: 8 },
      capabilities: {
        text: true,
        image: true,
        reasoning: true,
        code: true,
        translation: true,
        summary: true,
      },
      contextWindow: 128000,
    });

    this.modelProfiles.set("gpt-4o-mini", {
      model: "gpt-4o-mini",
      cost: { input: 0.15, output: 0.6 },
      performance: { speed: 9, quality: 6, reasoning: 5 },
      capabilities: {
        text: true,
        image: true,
        reasoning: false,
        code: true,
        translation: true,
        summary: true,
      },
      contextWindow: 128000,
    });

    this.modelProfiles.set("gpt-4-turbo", {
      model: "gpt-4-turbo",
      cost: { input: 10.0, output: 30.0 },
      performance: { speed: 5, quality: 8, reasoning: 9 },
      capabilities: {
        text: true,
        image: true,
        reasoning: true,
        code: true,
        translation: true,
        summary: true,
      },
      contextWindow: 128000,
    });

    this.modelProfiles.set("gpt-3.5-turbo", {
      model: "gpt-3.5-turbo",
      cost: { input: 0.5, output: 1.5 },
      performance: { speed: 10, quality: 5, reasoning: 4 },
      capabilities: {
        text: true,
        image: false,
        reasoning: false,
        code: true,
        translation: true,
        summary: true,
      },
      contextWindow: 16385,
    });
  }

  private getAvailableModels(criteria: ModelSelectionCriteria): ModelRef[] {
    const models: ModelRef[] = [];

    for (const [modelId, profile] of this.modelProfiles.entries()) {
      // Filter by task type
      if (!profile.capabilities[criteria.taskType]) {
        continue;
      }

      // Filter by multimodal requirement
      if (criteria.requiresMultimodal && !profile.capabilities.image) {
        continue;
      }

      // Filter by reasoning requirement
      if (criteria.requiresReasoning && !profile.capabilities.reasoning) {
        continue;
      }

      // Filter by context length
      if (criteria.contextLength && profile.contextWindow < criteria.contextLength) {
        continue;
      }

      // Find model in config
      const modelRef = this.findModelInConfig(modelId);
      if (modelRef) {
        models.push(modelRef);
      }
    }

    return models;
  }

  private findModelInConfig(modelId: string): ModelRef | null {
    const providers = this.config.models?.providers || {};

    for (const [provider, providerConfig] of Object.entries(providers)) {
      const model = providerConfig.models.find((m) => m.id === modelId);
      if (model) {
        return {
          provider,
          model: modelId,
        };
      }
    }

    return null;
  }

  private async scoreModels(
    models: ModelRef[],
    criteria: ModelSelectionCriteria,
  ): Promise<Array<{ model: ModelRef; score: number }>> {
    const scored = [];

    for (const model of models) {
      const profile = this.modelProfiles.get(model.model);
      if (!profile) {
        continue;
      }

      let score = 0;

      // Quality score based on task complexity
      const qualityWeight = this.getQualityWeight(criteria);
      score += profile.performance.quality * qualityWeight;

      // Speed score based on urgency
      const speedWeight = this.getSpeedWeight(criteria);
      score += profile.performance.speed * speedWeight;

      // Cost score based on cost sensitivity
      const costWeight = this.getCostWeight(criteria);
      const costScore = this.calculateCostScore(profile.cost, criteria);
      score += costScore * costWeight;

      // Reasoning score if needed
      if (criteria.requiresReasoning) {
        score += profile.performance.reasoning * 2;
      }

      scored.push({ model, score });
    }

    return scored;
  }

  private getQualityWeight(criteria: ModelSelectionCriteria): number {
    switch (criteria.complexity) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 1;
    }
  }

  private getSpeedWeight(criteria: ModelSelectionCriteria): number {
    switch (criteria.urgency) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 1;
    }
  }

  private getCostWeight(criteria: ModelSelectionCriteria): number {
    switch (criteria.costSensitivity) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 1;
    }
  }

  private calculateCostScore(
    cost: { input: number; output: number },
    _criteria: ModelSelectionCriteria,
  ): number {
    const avgCost = (cost.input + cost.output) / 2;

    // Invert cost so lower cost = higher score
    const normalizedScore = Math.max(0, 10 - avgCost / 5); // Scale assuming max $5 per 1M tokens

    return normalizedScore;
  }

  private async applyBudgetConstraints(
    scoredModels: Array<{ model: ModelRef; score: number }>,
    criteria: ModelSelectionCriteria,
  ): Promise<ModelRef> {
    if (!criteria.budgetRemaining) {
      return scoredModels[0].model;
    }

    // Filter models that fit the budget
    const affordableModels = scoredModels.filter(({ model }) => {
      const profile = this.modelProfiles.get(model.model);
      if (!profile) {
        return false;
      }

      // Estimate cost for a typical request (1000 input, 500 output tokens)
      const estimatedCost = this.getModelCostEstimate(model.model, 1000, 500);
      return estimatedCost <= criteria.budgetRemaining!;
    });

    // If no models fit the budget, use the cheapest available
    if (affordableModels.length === 0) {
      const cheapestModel = scoredModels.toSorted((a, b) => {
        const profileA = this.modelProfiles.get(a.model.model)!;
        const profileB = this.modelProfiles.get(b.model.model)!;
        return (
          profileA.cost.input + profileA.cost.output - (profileB.cost.input + profileB.cost.output)
        );
      })[0];

      return cheapestModel.model;
    }

    return affordableModels[0].model;
  }

  private findBetterModels(
    currentProfile: ModelPerformanceProfile,
    _criteria: ModelSelectionCriteria,
  ): ModelRef[] {
    const betterModels: ModelRef[] = [];

    for (const [modelId, profile] of this.modelProfiles.entries()) {
      // Skip same or worse models
      if (profile.performance.quality <= currentProfile.performance.quality) {
        continue;
      }

      // Check if model supports the task type
      if (!profile.capabilities[_criteria.taskType]) {
        continue;
      }

      const modelRef = this.findModelInConfig(modelId);
      if (modelRef) {
        betterModels.push(modelRef);
      }
    }

    return betterModels;
  }

  private async checkAffordability(model: ModelRef, budgetRemaining?: number): Promise<boolean> {
    if (!budgetRemaining) {
      return true;
    }

    const profile = this.modelProfiles.get(model.model);
    if (!profile) {
      return false;
    }

    // Estimate cost for typical request
    const estimatedCost = this.getModelCostEstimate(model.model, 1000, 500);
    return estimatedCost <= budgetRemaining;
  }
}
