export type UsageRecord = {
  id: string;
  agentId: string;
  sessionId: string;
  provider: string;
  model: string;
  usage: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    total: number;
  };
  cost: number;
  timestamp: Date;
  metadata?: {
    taskType?: string;
    duration?: number;
    success: boolean;
    error?: string;
  };
};

export type UsageAggregate = {
  period: string;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  averageCostPerRequest: number;
  breakdown: {
    [provider: string]: {
      [model: string]: {
        cost: number;
        tokens: number;
        requests: number;
      };
    };
  };
};

export type BudgetStatus = {
  period: "day" | "week" | "month";
  budget?: number;
  spent: number;
  remaining?: number;
  percentage?: number;
  overBudget: boolean;
  alerts: Array<{
    level: "warning" | "critical";
    threshold: number;
    current: number;
    message: string;
  }>;
};

export type CostControls = {
  dailyBudget?: number;
  weeklyBudget?: number;
  monthlyBudget?: number;
  alerts?: {
    percentage?: number; // Alert at % of budget
    absolute?: number; // Alert at absolute cost
  };
  modelBudgets?: Record<
    string,
    {
      dailyLimit?: number;
      costThreshold?: number; // Switch to cheaper model
    }
  >;
};

export type UsageTrackerConfig = {
  enabled: boolean;
  storage: {
    type: "sqlite" | "json";
    path?: string;
  };
  retention: {
    days: number;
  };
  aggregation: {
    enabled: boolean;
    intervals: Array<"hour" | "day" | "week" | "month">;
  };
};
