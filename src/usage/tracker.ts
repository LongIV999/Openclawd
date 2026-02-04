import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedUsage } from "../agents/usage.js";
import type { ModelCostConfig } from "../utils/usage-format.js";
import type { UsageRecord, UsageAggregate, BudgetStatus, UsageTrackerConfig } from "./types.js";
import { estimateUsageCost } from "../utils/usage-format.js";

export class UsageTracker {
  private config: UsageTrackerConfig;
  private storagePath: string;

  constructor(config?: Partial<UsageTrackerConfig>) {
    this.config = {
      enabled: true,
      storage: {
        type: "json",
        path: "~/.openclaw/usage",
      },
      retention: {
        days: 90,
      },
      aggregation: {
        enabled: true,
        intervals: ["day", "week", "month"] as const,
      },
      ...config,
    };

    // Expand tilde and ensure directory exists
    this.storagePath = this.config.storage.path!.replace("~", process.env.HOME || "~");
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async recordUsage(params: {
    agentId: string;
    sessionId: string;
    provider: string;
    model: string;
    usage: NormalizedUsage;
    cost?: ModelCostConfig;
    metadata?: UsageRecord["metadata"];
  }): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cost = params.cost ? estimateUsageCost({ usage: params.usage, cost: params.cost }) : 0;

    const record: UsageRecord = {
      id: randomUUID(),
      agentId: params.agentId,
      sessionId: params.sessionId,
      provider: params.provider,
      model: params.model,
      usage: {
        input: params.usage.input || 0,
        output: params.usage.output || 0,
        cacheRead: params.usage.cacheRead || 0,
        cacheWrite: params.usage.cacheWrite || 0,
        total: params.usage.total || (params.usage.input || 0) + (params.usage.output || 0),
      },
      cost: cost || 0,
      timestamp: new Date(),
      metadata: {
        success: true,
        ...params.metadata,
      },
    };

    await this.saveRecord(record);

    // Update aggregations
    if (this.config.aggregation.enabled) {
      await this.updateAggregations(record);
    }
  }

  async getUsageHistory(params: {
    agentId?: string;
    provider?: string;
    model?: string;
    period: "day" | "week" | "month";
    startDate?: Date;
    endDate?: Date;
  }): Promise<UsageAggregate[]> {
    const endDate = params.endDate || new Date();
    const startDate = params.startDate || this.getPeriodStart(params.period, endDate);

    const records = await this.loadRecords({
      agentId: params.agentId,
      provider: params.provider,
      model: params.model,
      startDate,
      endDate,
    });

    return this.aggregateRecords(records, params.period);
  }

  async checkBudget(params: {
    agentId?: string;
    period: "day" | "week" | "month";
    budget?: number;
  }): Promise<BudgetStatus> {
    const endDate = new Date();
    const startDate = this.getPeriodStart(params.period, endDate);

    const records = await this.loadRecords({
      agentId: params.agentId,
      startDate,
      endDate,
    });

    const spent = records.reduce((total, record) => total + record.cost, 0);
    const budget = params.budget;

    const status: BudgetStatus = {
      period: params.period,
      budget,
      spent,
      remaining: budget ? Math.max(0, budget - spent) : undefined,
      percentage: budget ? (spent / budget) * 100 : undefined,
      overBudget: budget ? spent > budget : false,
      alerts: [],
    };

    // Generate alerts
    if (budget && status.percentage) {
      if (status.percentage >= 100) {
        status.alerts.push({
          level: "critical",
          threshold: 100,
          current: status.percentage,
          message: `Budget exceeded for ${params.period}: $${spent.toFixed(2)} / $${budget.toFixed(2)}`,
        });
      } else if (status.percentage >= 80) {
        status.alerts.push({
          level: "warning",
          threshold: 80,
          current: status.percentage,
          message: `Budget warning for ${params.period}: $${spent.toFixed(2)} / $${budget.toFixed(2)} (${status.percentage.toFixed(1)}%)`,
        });
      }
    }

    return status;
  }

  async getTopCostModels(params: {
    period: "day" | "week" | "month";
    limit?: number;
  }): Promise<Array<{ provider: string; model: string; cost: number; requests: number }>> {
    const endDate = new Date();
    const startDate = this.getPeriodStart(params.period, endDate);

    const records = await this.loadRecords({ startDate, endDate });
    const modelStats = new Map<string, { cost: number; requests: number }>();

    records.forEach((record) => {
      const key = `${record.provider}:${record.model}`;
      const existing = modelStats.get(key) || { cost: 0, requests: 0 };
      modelStats.set(key, {
        cost: existing.cost + record.cost,
        requests: existing.requests + 1,
      });
    });

    return Array.from(modelStats.entries())
      .map(([key, stats]) => {
        const [provider, model] = key.split(":");
        return { provider, model, cost: stats.cost, requests: stats.requests };
      })
      .toSorted((a, b) => b.cost - a.cost)
      .slice(0, params.limit || 10);
  }

  private async saveRecord(record: UsageRecord): Promise<void> {
    const date = record.timestamp.toISOString().split("T")[0];
    const filePath = join(this.storagePath, `${date}.json`);

    let records: UsageRecord[] = [];
    if (existsSync(filePath)) {
      try {
        records = JSON.parse(readFileSync(filePath, "utf-8"));
      } catch {
        // File corrupted, start fresh
        records = [];
      }
    }

    records.push(record);
    writeFileSync(filePath, JSON.stringify(records, null, 2));
  }

  private async loadRecords(params: {
    agentId?: string;
    provider?: string;
    model?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<UsageRecord[]> {
    const records: UsageRecord[] = [];
    const startDate = params.startDate || new Date(0);
    const endDate = params.endDate || new Date();

    // Load all relevant daily files
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const date = currentDate.toISOString().split("T")[0];
      const filePath = join(this.storagePath, `${date}.json`);

      if (existsSync(filePath)) {
        try {
          const dayRecords: UsageRecord[] = JSON.parse(readFileSync(filePath, "utf-8"));
          records.push(
            ...dayRecords.filter((record) => {
              const recordDate = new Date(record.timestamp);
              if (recordDate < startDate || recordDate > endDate) {
                return false;
              }
              if (params.agentId && record.agentId !== params.agentId) {
                return false;
              }
              if (params.provider && record.provider !== params.provider) {
                return false;
              }
              if (params.model && record.model !== params.model) {
                return false;
              }
              return true;
            }),
          );
        } catch {
          // Skip corrupted files
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return records;
  }

  private aggregateRecords(
    records: UsageRecord[],
    period: "day" | "week" | "month",
  ): UsageAggregate[] {
    const aggregates = new Map<string, UsageAggregate>();

    records.forEach((record) => {
      const periodKey = this.getPeriodKey(record.timestamp, period);

      if (!aggregates.has(periodKey)) {
        aggregates.set(periodKey, {
          period: periodKey,
          totalCost: 0,
          totalTokens: 0,
          requestCount: 0,
          averageCostPerRequest: 0,
          breakdown: {},
        });
      }

      const aggregate = aggregates.get(periodKey)!;
      aggregate.totalCost += record.cost;
      aggregate.totalTokens += record.usage.total;
      aggregate.requestCount += 1;

      // Provider/model breakdown
      if (!aggregate.breakdown[record.provider]) {
        aggregate.breakdown[record.provider] = {};
      }
      if (!aggregate.breakdown[record.provider][record.model]) {
        aggregate.breakdown[record.provider][record.model] = {
          cost: 0,
          tokens: 0,
          requests: 0,
        };
      }

      const breakdown = aggregate.breakdown[record.provider][record.model];
      breakdown.cost += record.cost;
      breakdown.tokens += record.usage.total;
      breakdown.requests += 1;
    });

    // Calculate averages
    aggregates.forEach((aggregate) => {
      aggregate.averageCostPerRequest =
        aggregate.requestCount > 0 ? aggregate.totalCost / aggregate.requestCount : 0;
    });

    return Array.from(aggregates.values()).toSorted((a, b) => b.period.localeCompare(a.period));
  }

  private getPeriodStart(period: "day" | "week" | "month", date: Date): Date {
    const start = new Date(date);

    switch (period) {
      case "day":
        start.setHours(0, 0, 0, 0);
        break;
      case "week":
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return start;
  }

  private getPeriodKey(date: Date, period: "day" | "week" | "month"): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    switch (period) {
      case "day":
        return `${year}-${month}-${day}`;
      case "week":
        const weekStart = new Date(date);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        const weekYear = weekStart.getFullYear();
        const weekMonth = String(weekStart.getMonth() + 1).padStart(2, "0");
        const weekDay = String(weekStart.getDate()).padStart(2, "0");
        return `${weekYear}-${weekMonth}-${weekDay} (Week)`;
      case "month":
        return `${year}-${month}`;
    }
  }

  private async updateAggregations(_record: UsageRecord): Promise<void> {
    // This could be implemented to pre-compute aggregations
    // For now, we'll compute them on-demand
  }
}
