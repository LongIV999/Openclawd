import type { RuntimeEnv } from "../runtime.js";
import { CostOptimizationManager } from "../ai/cost-optimization-manager.js";
import { loadConfig } from "../config/config.js";

export async function usageCommand(
  opts: {
    agent?: string;
    period?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
) {
  const config = loadConfig();

  const costManager = new CostOptimizationManager(config, {
    enabled: true,
    tracker: { enabled: true },
    cache: { enabled: true },
    budget: { enabled: true },
    optimization: { enabled: true },
  });

  // Show dashboard
  const dashboard = await costManager.getUsageDashboard(opts.agent);
  if (dashboard) {
    if (opts.json) {
      console.log(JSON.stringify({ dashboard }, null, 2));
    } else {
      console.log(dashboard);
    }
  } else {
    runtime.error("❌ Usage tracking is not enabled");
    return;
  }

  // Show optimization suggestions
  const suggestions = await costManager.getCostOptimizationSuggestions({
    agentId: opts.agent,
    period: (opts.period as "day" | "week" | "month") || "week",
  });

  if (suggestions.length > 0 && !opts.json) {
    console.log("\n💡 Cost Optimization Suggestions");
    console.log("─".repeat(40));
    suggestions.forEach((suggestion, index) => {
      const emoji = suggestion.type === "model-substitution" ? "🔄" : "⚡";
      console.log(`${index + 1}. ${emoji} ${suggestion.description}`);
      if (suggestion.potentialSavings) {
        console.log(`   💰 Potential savings: $${suggestion.potentialSavings.toFixed(2)}`);
      }
    });

    if (opts.json) {
      console.log(JSON.stringify({ suggestions }, null, 2));
    }
  }

  return { dashboard, suggestions };
}
