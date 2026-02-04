/**
 * Viral Hunter Telegram Bridge
 *
 * Telegram command handlers for Viral Content Hunter
 * Commands: /viral, /trend, /hunt, /huntai
 */

import { Context } from "grammy";
import type { OpenClawConfig } from "../config/types.js";
import { getChildLogger } from "../logging.js";
import {
  createViralHunter,
  ViralHuntResult,
  HuntOptions,
  ViralPost,
} from "../providers/perplexity/viral-hunter.js";
import { recordSentMessage } from "./sent-message-cache.js";

const logger = getChildLogger({ module: "telegram-viral-bridge" });

// Cache for rate limiting and avoiding duplicate requests
const requestCache = new Map<string, { result: ViralHuntResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get Perplexity API key from config or environment
 */
function getApiKey(cfg: OpenClawConfig): string | undefined {
  // Check config first
  const configKey = (cfg as any).perplexity?.apiKey;
  if (configKey) return configKey;

  // Fall back to environment
  return process.env.PERPLEXITY_API_KEY;
}

/**
 * Check if result is cached and still valid
 */
function getCachedResult(cacheKey: string): ViralHuntResult | null {
  const cached = requestCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    requestCache.delete(cacheKey);
    return null;
  }

  return cached.result;
}

/**
 * Cache a result
 */
function cacheResult(cacheKey: string, result: ViralHuntResult): void {
  requestCache.set(cacheKey, { result, timestamp: Date.now() });
}

/**
 * Format result for Telegram display
 */
function formatForTelegram(result: ViralHuntResult): string {
  const lines: string[] = [];

  lines.push(`🔥 **VIRAL CONTENT: ${result.topic.toUpperCase()}**`);
  lines.push(`📅 ${new Date(result.searchDate).toLocaleDateString("vi-VN")}`);
  lines.push(``);

  if (result.posts.length === 0) {
    lines.push(`❌ Không tìm thấy bài đăng viral nào.`);
    return lines.join("\n");
  }

  // List each post
  result.posts.forEach((post: ViralPost, i: number) => {
    const platformEmojis: Record<ViralPost["platform"], string> = {
      x: "🐦",
      reddit: "🔴",
      threads: "🧵",
      hacker_news: "🟠",
      other: "📱",
    };
    const platformEmoji = platformEmojis[post.platform];

    lines.push(`**${i + 1}. ${platformEmoji} ${post.title}**`);
    lines.push(post.summary);
    if (post.source) {
      lines.push(`👤 ${post.source}`);
    }
    if (post.engagement) {
      lines.push(`📊 ${post.engagement}`);
    }
    if (post.url) {
      lines.push(`🔗 ${post.url}`);
    }
    lines.push(``);
  });

  // Add separator
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(``);

  // Add Facebook-ready content
  lines.push(`📘 **SẴN SÀNG CHO FACEBOOK:**`);
  lines.push(``);
  lines.push(result.facebookReady);

  // Add sources
  if (result.sources.length > 0) {
    lines.push(``);
    lines.push(
      `📚 Nguồn: ${result.sources.slice(0, 3).join(", ")}${result.sources.length > 3 ? "..." : ""}`,
    );
  }

  return lines.join("\n");
}

/**
 * Parse options from command arguments
 */
function parseOptions(args: string): { topic: string; options: HuntOptions } {
  const parts = args.trim().split(/\s+/);
  const options: HuntOptions = {};
  const topicParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].toLowerCase();

    // Platform filter
    if (part === "--x" || part === "-x") {
      options.platforms = [...(options.platforms || []), "x"];
    } else if (part === "--reddit" || part === "-r") {
      options.platforms = [...(options.platforms || []), "reddit"];
    } else if (part === "--threads" || part === "-t") {
      options.platforms = [...(options.platforms || []), "threads"];
    } else if (part === "--hn" || part === "-h") {
      options.platforms = [...(options.platforms || []), "hacker_news"];
    }
    // Recency filter
    else if (part === "--week" || part === "-w") {
      options.recency = "week";
    }
    // Count
    else if (part.startsWith("--count=") || part.startsWith("-n=")) {
      const count = parseInt(part.split("=")[1], 10);
      if (!isNaN(count) && count > 0 && count <= 10) {
        options.maxPosts = count;
      }
    }
    // English output
    else if (part === "--en" || part === "-e") {
      options.language = "en";
    }
    // Everything else is topic
    else if (!part.startsWith("-")) {
      topicParts.push(parts[i]); // Use original case
    }
  }

  return {
    topic: topicParts.join(" ") || "công nghệ",
    options,
  };
}

/**
 * Handle /viral command
 * Usage: /viral <topic> [options]
 * Options:
 *   -x, --x        Filter to X/Twitter only
 *   -r, --reddit   Filter to Reddit only
 *   -t, --threads  Filter to Threads only
 *   -h, --hn       Filter to Hacker News only
 *   -w, --week     Search past week (default: today)
 *   -n=N, --count=N  Number of posts (1-10, default: 5)
 *   -e, --en       Output in English
 */
export async function handleViralCommand(
  ctx: Context,
  cfg: OpenClawConfig,
  content: string,
): Promise<void> {
  const apiKey = getApiKey(cfg);

  if (!apiKey) {
    await ctx.reply(
      "⚠️ Perplexity API chưa được cấu hình.\n\n" +
        "Vui lòng thêm PERPLEXITY_API_KEY vào environment variables hoặc config.",
    );
    return;
  }

  const { topic, options } = parseOptions(content);

  // Check cache
  const cacheKey = JSON.stringify({ topic, options });
  const cached = getCachedResult(cacheKey);

  if (cached) {
    logger.debug("Returning cached viral result", { topic });
    const sent = await ctx.reply(formatForTelegram(cached), { parse_mode: "Markdown" });
    recordSentMessage(sent.chat.id, sent.message_id);
    return;
  }

  try {
    const sentInit = await ctx.reply(`🔍 Đang tìm kiếm viral content về "${topic}"...`);
    recordSentMessage(sentInit.chat.id, sentInit.message_id);

    const hunter = createViralHunter(apiKey);
    const result = await hunter.hunt(topic, options);

    // Cache the result
    cacheResult(cacheKey, result);

    // Send formatted result
    const formatted = formatForTelegram(result);

    // Telegram has a 4096 character limit, split if needed
    if (formatted.length > 4000) {
      const parts = splitMessage(formatted, 4000);
      for (const part of parts) {
        const sent = await ctx.reply(part, { parse_mode: "Markdown" });
        recordSentMessage(sent.chat.id, sent.message_id);
      }
    } else {
      const sent = await ctx.reply(formatted, { parse_mode: "Markdown" });
      recordSentMessage(sent.chat.id, sent.message_id);
    }
  } catch (err: any) {
    logger.error(`Viral hunt failed: ${err.message}`, { topic, error: err });
    await ctx.reply(`❌ Lỗi khi tìm kiếm: ${err.message}`);
  }
}

/**
 * Handle /trend command - Quick trending tech today
 * Usage: /trend [options]
 */
export async function handleTrendCommand(
  ctx: Context,
  cfg: OpenClawConfig,
  content: string,
): Promise<void> {
  const { options } = parseOptions(content || "trending tech");
  return handleViralCommand(ctx, cfg, `trending technology ${content} ${optionsToArgs(options)}`);
}

/**
 * Handle /huntai command - AI/ML specific hunt
 * Usage: /huntai [options]
 */
export async function handleHuntAICommand(
  ctx: Context,
  cfg: OpenClawConfig,
  content: string,
): Promise<void> {
  const { options } = parseOptions(content || "AI");
  return handleViralCommand(
    ctx,
    cfg,
    `AI artificial intelligence ${content} ${optionsToArgs(options)}`,
  );
}

/**
 * Handle /hunt command - Shorthand for /viral
 */
export async function handleHuntCommand(
  ctx: Context,
  cfg: OpenClawConfig,
  content: string,
): Promise<void> {
  return handleViralCommand(ctx, cfg, content);
}

/**
 * Convert options back to args string
 */
function optionsToArgs(options: HuntOptions): string {
  const args: string[] = [];

  if (options.platforms) {
    for (const p of options.platforms) {
      args.push(`--${p === "hacker_news" ? "hn" : p}`);
    }
  }
  if (options.recency === "week") args.push("--week");
  if (options.maxPosts) args.push(`--count=${options.maxPosts}`);
  if (options.language === "en") args.push("--en");

  return args.join(" ");
}

/**
 * Split a long message into chunks
 */
function splitMessage(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf("\n\n", maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf("\n", maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1) {
      breakPoint = maxLength;
    }

    parts.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return parts;
}

/**
 * Get command help text
 */
export function getViralHelpText(): string {
  return `
🔥 **VIRAL CONTENT HUNTER**

**Lệnh:**
• \`/viral <chủ đề>\` - Tìm viral content về chủ đề
• \`/trend\` - Trending tech hôm nay
• \`/huntai\` - Viral AI/ML content
• \`/hunt <chủ đề>\` - Alias cho /viral

**Tùy chọn:**
• \`-x\` - Chỉ X/Twitter
• \`-r\` - Chỉ Reddit
• \`-t\` - Chỉ Threads
• \`-h\` - Chỉ Hacker News
• \`-w\` - Tìm trong tuần (mặc định: hôm nay)
• \`-n=5\` - Số bài (1-10)
• \`-e\` - Kết quả tiếng Anh

**Ví dụ:**
• \`/viral AI startup\`
• \`/viral ChatGPT -x -r\`
• \`/hunt blockchain -n=3 -w\`
`.trim();
}
