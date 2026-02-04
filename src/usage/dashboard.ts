import type { OpenClawConfig } from "../config/config.js";
import type { BudgetStatus } from "./types.js";
import { formatTokenCount, formatUsd } from "../utils/usage-format.js";
import { UsageTracker } from "./tracker.js";

export type DashboardMetrics = {
  currentPeriod: {
    daily: PeriodMetrics;
    weekly: PeriodMetrics;
    monthly: PeriodMetrics;
  };
  topModels: Array<{
    provider: string;
    model: string;
    cost: number;
    requests: number;
    averageCost: number;
  }>;
  budgetStatus: {
    daily: BudgetStatus;
    weekly: BudgetStatus;
    monthly: BudgetStatus;
  };
  trends: {
    costTrend: "increasing" | "decreasing" | "stable";
    usageTrend: "increasing" | "decreasing" | "stable";
    dailyAverage: number;
    projectedMonthly: number;
  };
};

export type PeriodMetrics = {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  averageCostPerRequest: number;
  topProvider: string;
  topModel: string;
};

export class UsageDashboard {
  private tracker: UsageTracker;
  private config: OpenClawConfig;

  constructor(config: OpenClawConfig, tracker?: UsageTracker) {
    this.config = config;
    this.tracker = tracker || new UsageTracker();
  }

  async getMetrics(agentId?: string): Promise<DashboardMetrics> {
    // Get current period metrics
    const dailyMetrics = await this.getPeriodMetrics("day", agentId);
    const weeklyMetrics = await this.getPeriodMetrics("week", agentId);
    const monthlyMetrics = await this.getPeriodMetrics("month", agentId);

    // Get top models (monthly)
    const topModels = await this.tracker.getTopCostModels({ period: "month", limit: 10 });

    // Get budget status
    const costOptimization = this.config.models?.costOptimization;
    const dailyBudget = await this.tracker.checkBudget({
      agentId,
      period: "day",
      budget: costOptimization?.budgetLimits?.daily,
    });
    const weeklyBudget = await this.tracker.checkBudget({
      agentId,
      period: "week",
      budget: costOptimization?.budgetLimits?.weekly,
    });
    const monthlyBudget = await this.tracker.checkBudget({
      agentId,
      period: "month",
      budget: costOptimization?.budgetLimits?.monthly,
    });

    // Calculate trends
    const trends = await this.calculateTrends(agentId);

    return {
      currentPeriod: {
        daily: dailyMetrics,
        weekly: weeklyMetrics,
        monthly: monthlyMetrics,
      },
      topModels: topModels.map((model) => ({
        ...model,
        averageCost: model.requests > 0 ? model.cost / model.requests : 0,
      })),
      budgetStatus: {
        daily: dailyBudget,
        weekly: weeklyBudget,
        monthly: monthlyBudget,
      },
      trends,
    };
  }

  async formatMetricsReport(metrics: DashboardMetrics): Promise<string> {
    const report: string[] = [];

    // Header
    report.push("📊 OpenClaw Usage Dashboard");
    report.push("═".repeat(50));
    report.push("");

    // Current Period Summary
    report.push("📈 Current Usage Summary");
    report.push("─".repeat(30));

    // Daily
    const daily = metrics.currentPeriod.daily;
    report.push(
      `Daily: ${formatUsd(daily.totalCost)} | ${formatTokenCount(daily.totalTokens)} tokens | ${daily.requestCount} requests`,
    );
    if (daily.topProvider && daily.topModel) {
      report.push(`  Top: ${daily.topProvider}/${daily.topModel}`);
    }

    // Weekly
    const weekly = metrics.currentPeriod.weekly;
    report.push(
      `Weekly: ${formatUsd(weekly.totalCost)} | ${formatTokenCount(weekly.totalTokens)} tokens | ${weekly.requestCount} requests`,
    );

    // Monthly
    const monthly = metrics.currentPeriod.monthly;
    report.push(
      `Monthly: ${formatUsd(monthly.totalCost)} | ${formatTokenCount(monthly.totalTokens)} tokens | ${monthly.requestCount} requests`,
    );
    report.push("");

    // Budget Status
    report.push("💰 Budget Status");
    report.push("─".repeat(30));

    if (metrics.budgetStatus.daily.budget) {
      const dailyStatus = metrics.budgetStatus.daily;
      report.push(
        `Daily: ${formatUsd(dailyStatus.spent)} / ${formatUsd(dailyStatus.budget)} (${dailyStatus.percentage?.toFixed(1)}%)`,
      );

      if (dailyStatus.alerts.length > 0) {
        dailyStatus.alerts.forEach((alert) => {
          const emoji = alert.level === "critical" ? "🚨" : "⚠️";
          report.push(`  ${emoji} ${alert.message}`);
        });
      }
    } else {
      report.push("Daily: No budget set");
    }

    if (metrics.budgetStatus.monthly.budget) {
      const monthlyStatus = metrics.budgetStatus.monthly;
      report.push(
        `Monthly: ${formatUsd(monthlyStatus.spent)} / ${formatUsd(monthlyStatus.budget)} (${monthlyStatus.percentage?.toFixed(1)}%)`,
      );
    }
    report.push("");

    // Top Models
    if (metrics.topModels.length > 0) {
      report.push("🏆 Top Models (Monthly)");
      report.push("─".repeat(30));

      metrics.topModels.slice(0, 5).forEach((model, index) => {
        const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
        report.push(`${emoji} ${model.provider}/${model.model}`);
        report.push(
          `   ${formatUsd(model.cost)} | ${model.requests} requests | avg: ${formatUsd(model.averageCost)}`,
        );
      });
      report.push("");
    }

    // Trends
    report.push("📊 Trends");
    report.push("─".repeat(30));
    const costEmoji =
      metrics.trends.costTrend === "increasing"
        ? "📈"
        : metrics.trends.costTrend === "decreasing"
          ? "📉"
          : "➡️";
    const usageEmoji =
      metrics.trends.usageTrend === "increasing"
        ? "📈"
        : metrics.trends.usageTrend === "decreasing"
          ? "📉"
          : "➡️";

    report.push(`Cost trend: ${costEmoji} ${metrics.trends.costTrend}`);
    report.push(`Usage trend: ${usageEmoji} ${metrics.trends.usageTrend}`);
    report.push(`Daily average: ${formatUsd(metrics.trends.dailyAverage)}`);
    report.push(`Projected monthly: ${formatUsd(metrics.trends.projectedMonthly)}`);

    return report.join("\n");
  }

  private async getPeriodMetrics(
    period: "day" | "week" | "month",
    agentId?: string,
  ): Promise<PeriodMetrics> {
    const usageHistory = await this.tracker.getUsageHistory({ period, agentId });

    if (usageHistory.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        averageCostPerRequest: 0,
        topProvider: "",
        topModel: "",
      };
    }

    const latest = usageHistory[0]; // Most recent period

    // Find top provider and model
    let topProvider = "";
    let topModel = "";
    let maxCost = 0;

    for (const [provider, models] of Object.entries(latest.breakdown)) {
      for (const [model, stats] of Object.entries(models)) {
        if (stats.cost > maxCost) {
          maxCost = stats.cost;
          topProvider = provider;
          topModel = model;
        }
      }
    }

    return {
      totalCost: latest.totalCost,
      totalTokens: latest.totalTokens,
      requestCount: latest.requestCount,
      averageCostPerRequest: latest.averageCostPerRequest,
      topProvider,
      topModel,
    };
  }

  private async calculateTrends(agentId?: string): Promise<DashboardMetrics["trends"]> {
    // Get last 7 days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6); // Last 7 days including today

    const dailyData = await this.tracker.getUsageHistory({
      period: "day",
      agentId,
      startDate,
      endDate,
    });

    if (dailyData.length < 2) {
      return {
        costTrend: "stable",
        usageTrend: "stable",
        dailyAverage: 0,
        projectedMonthly: 0,
      };
    }

    // Calculate trends by comparing recent days to earlier days
    const recentDays = dailyData.slice(0, 3); // Most recent 3 days
    const earlierDays = dailyData.slice(3); // Previous days

    const recentAvgCost =
      recentDays.reduce((sum, day) => sum + day.totalCost, 0) / recentDays.length;
    const earlierAvgCost =
      earlierDays.reduce((sum, day) => sum + day.totalCost, 0) / earlierDays.length;

    const recentAvgTokens =
      recentDays.reduce((sum, day) => sum + day.totalTokens, 0) / recentDays.length;
    const earlierAvgTokens =
      earlierDays.reduce((sum, day) => sum + day.totalTokens, 0) / earlierDays.length;

    const costThreshold = 0.1; // 10% change threshold
    const usageThreshold = 0.1; // 10% change threshold

    let costTrend: "increasing" | "decreasing" | "stable" = "stable";
    if (recentAvgCost > earlierAvgCost * (1 + costThreshold)) {
      costTrend = "increasing";
    } else if (recentAvgCost < earlierAvgCost * (1 - costThreshold)) {
      costTrend = "decreasing";
    }

    let usageTrend: "increasing" | "decreasing" | "stable" = "stable";
    if (recentAvgTokens > earlierAvgTokens * (1 + usageThreshold)) {
      usageTrend = "increasing";
    } else if (recentAvgTokens < earlierAvgTokens * (1 - usageThreshold)) {
      usageTrend = "decreasing";
    }

    // Calculate daily average and projection
    const totalCost = dailyData.reduce((sum, day) => sum + day.totalCost, 0);
    const dailyAverage = totalCost / dailyData.length;
    const projectedMonthly = dailyAverage * 30; // Simple projection

    return {
      costTrend,
      usageTrend,
      dailyAverage,
      projectedMonthly,
    };
  }
}
