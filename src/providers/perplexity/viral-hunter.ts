/**
 * Viral Content Hunter Service
 *
 * Tìm kiếm và tổng hợp viral content từ các nền tảng mạng xã hội
 * về công nghệ, sau đó dịch sang tiếng Việt và format cho Facebook.
 */

import { getChildLogger } from "../../logging.js";
import { PerplexityClient, createPerplexityClient, PerplexityResponse } from "./client.js";

const logger = getChildLogger({ module: "viral-hunter" });

// Types
export interface ViralPost {
  title: string;
  summary: string;
  source: string;
  platform: "x" | "reddit" | "threads" | "hacker_news" | "other";
  url?: string;
  engagement?: string;
  originalDate?: string;
}

export interface ViralHuntResult {
  topic: string;
  posts: ViralPost[];
  facebookReady: string;
  searchDate: string;
  sources: string[];
}

export interface HuntOptions {
  platforms?: Array<"x" | "reddit" | "threads" | "hacker_news">;
  recency?: "day" | "week";
  maxPosts?: number;
  language?: "vi" | "en";
  includeHashtags?: boolean;
}

// Social Media Domain Filters
const PLATFORM_DOMAINS: Record<string, string[]> = {
  x: ["twitter.com", "x.com"],
  reddit: ["reddit.com"],
  threads: ["threads.net"],
  hacker_news: ["news.ycombinator.com"],
};

// Default config
const DEFAULT_OPTIONS: Required<HuntOptions> = {
  platforms: ["x", "reddit", "threads", "hacker_news"],
  recency: "day",
  maxPosts: 5,
  language: "vi",
  includeHashtags: true,
};

/**
 * Viral Content Hunter Service
 */
export class ViralHunterService {
  private client: PerplexityClient;

  constructor(client?: PerplexityClient) {
    this.client = client ?? createPerplexityClient();
  }

  /**
   * Hunt for viral tech content on specified topic
   */
  async hunt(topic: string, options?: HuntOptions): Promise<ViralHuntResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    logger.info("Starting viral hunt", { topic, options: opts });

    // Build domain filter from selected platforms
    const domainFilter = opts.platforms.flatMap((p) => PLATFORM_DOMAINS[p] || []);

    // Build the search prompt
    const systemPrompt = this.buildSystemPrompt(opts);
    const userQuery = this.buildSearchQuery(topic, opts);

    const response = await this.client.search(userQuery, {
      systemPrompt,
      searchDomainFilter: domainFilter.length > 0 ? domainFilter : undefined,
      searchRecencyFilter: opts.recency,
      returnCitations: true,
    });

    // Parse the response into structured data
    const result = this.parseResponse(topic, response, opts);

    logger.info("Viral hunt completed", {
      topic,
      postsFound: result.posts.length,
      sourcesCount: result.sources.length,
    });

    return result;
  }

  /**
   * Quick hunt for today's trending tech topics
   */
  async trendingToday(options?: HuntOptions): Promise<ViralHuntResult> {
    return this.hunt("trending technology news today", {
      ...options,
      recency: "day",
    });
  }

  /**
   * Hunt for AI/ML specific viral content
   */
  async huntAI(options?: HuntOptions): Promise<ViralHuntResult> {
    return this.hunt("AI artificial intelligence machine learning breakthroughs", options);
  }

  /**
   * Hunt by specific platform
   */
  async huntByPlatform(
    platform: "x" | "reddit" | "threads" | "hacker_news",
    topic: string,
    options?: Omit<HuntOptions, "platforms">,
  ): Promise<ViralHuntResult> {
    return this.hunt(topic, {
      ...options,
      platforms: [platform],
    });
  }

  private buildSystemPrompt(opts: Required<HuntOptions>): string {
    const languageInstruction =
      opts.language === "vi"
        ? `QUAN TRỌNG: Trả lời hoàn toàn bằng tiếng Việt. Dịch tất cả tiêu đề và nội dung sang tiếng Việt tự nhiên, chuyên nghiệp.`
        : `Respond in English.`;

    return `Bạn là chuyên gia nghiên cứu xu hướng công nghệ và mạng xã hội.
${languageInstruction}

NHIỆM VỤ:
1. Tìm kiếm các bài đăng VIRAL NHẤT về chủ đề được yêu cầu
2. Ưu tiên các bài có engagement cao (likes, retweets, comments, upvotes)
3. Tập trung vào nội dung công nghệ, AI, startup, coding
4. Chỉ lấy nội dung từ 24-48 giờ gần nhất (nếu có thể)

FORMAT OUTPUT - Sử dụng cấu trúc sau cho MỖI bài đăng:

---POST---
TIÊU ĐỀ: [Tiêu đề tiếng Việt]
TÓM TẮT: [Tóm tắt 2-3 câu bằng tiếng Việt]
NGUỒN: [Tên người/tài khoản đăng]
NỀN TẢNG: [x/reddit/threads/hacker_news]
ENGAGEMENT: [Ước tính: số likes, comments, shares nếu có]
URL: [Link gốc nếu có]
---END---

Sau tất cả các bài, thêm section:

---FACEBOOK---
[Viết 1 bài tổng hợp ngắn gọn, hấp dẫn để đăng Facebook]
[Sử dụng emoji phù hợp]
${opts.includeHashtags ? "[Thêm 3-5 hashtags tiếng Việt phù hợp]" : ""}
---END---`;
  }

  private buildSearchQuery(topic: string, opts: Required<HuntOptions>): string {
    const platformNames = opts.platforms
      .map((p) => {
        switch (p) {
          case "x":
            return "Twitter/X";
          case "reddit":
            return "Reddit";
          case "threads":
            return "Threads";
          case "hacker_news":
            return "Hacker News";
          default:
            return p;
        }
      })
      .join(", ");

    const timeframe = opts.recency === "day" ? "hôm nay (24 giờ qua)" : "tuần này";

    return `Tìm ${opts.maxPosts} bài đăng viral nhất về "${topic}" trên ${platformNames} ${timeframe}.
Ưu tiên các bài có nhiều engagement (likes, retweets, upvotes, comments).
Tập trung vào góc nhìn công nghệ, startup, developer, AI.`;
  }

  private parseResponse(
    topic: string,
    response: PerplexityResponse,
    opts: Required<HuntOptions>,
  ): ViralHuntResult {
    const posts: ViralPost[] = [];
    const content = response.content;

    // Parse individual posts
    const postMatches = content.matchAll(/---POST---\n([\s\S]*?)---END---/g);

    for (const match of postMatches) {
      const postContent = match[1];
      const post = this.parsePost(postContent);
      if (post) {
        posts.push(post);
      }
    }

    // Extract Facebook-ready content
    const fbMatch = content.match(/---FACEBOOK---\n([\s\S]*?)---END---/);
    const facebookReady = fbMatch
      ? fbMatch[1].trim()
      : this.generateFacebookPost(topic, posts, opts);

    return {
      topic,
      posts,
      facebookReady,
      searchDate: new Date().toISOString(),
      sources: response.citations.map((c) => c.url),
    };
  }

  private parsePost(content: string): ViralPost | null {
    const getField = (name: string): string => {
      const regex = new RegExp(`${name}:\\s*(.+?)(?:\\n|$)`, "i");
      const match = content.match(regex);
      return match?.[1]?.trim() ?? "";
    };

    const title = getField("TIÊU ĐỀ");
    const summary = getField("TÓM TẮT");

    if (!title || !summary) {
      logger.debug("Failed to parse post", { content });
      return null;
    }

    const platformRaw = getField("NỀN TẢNG").toLowerCase();
    let platform: ViralPost["platform"] = "other";
    if (platformRaw.includes("reddit")) {
      platform = "reddit";
    } else if (platformRaw.includes("x") || platformRaw.includes("twitter")) {
      platform = "x";
    } else if (platformRaw.includes("thread")) {
      platform = "threads";
    } else if (platformRaw.includes("hacker") || platformRaw.includes("hn")) {
      platform = "hacker_news";
    }

    return {
      title,
      summary,
      source: getField("NGUỒN"),
      platform,
      url: getField("URL") || undefined,
      engagement: getField("ENGAGEMENT") || undefined,
    };
  }

  private generateFacebookPost(
    topic: string,
    posts: ViralPost[],
    opts: Required<HuntOptions>,
  ): string {
    if (posts.length === 0) {
      return `🔍 Không tìm thấy bài đăng viral nào về "${topic}" hôm nay.`;
    }

    const lines = [
      `🔥 TOP ${posts.length} XU HƯỚNG CÔNG NGHỆ HÔM NAY 🔥`,
      ``,
      `Chủ đề: ${topic}`,
      ``,
    ];

    posts.forEach((post, i) => {
      const platformEmoji = {
        x: "🐦",
        reddit: "🔴",
        threads: "🧵",
        hacker_news: "🟠",
        other: "📱",
      }[post.platform];

      lines.push(`${i + 1}. ${platformEmoji} ${post.title}`);
      if (post.engagement) {
        lines.push(`   📊 ${post.engagement}`);
      }
    });

    lines.push(``);
    lines.push(`---`);
    lines.push(`💡 Theo dõi để cập nhật tin tech mỗi ngày!`);

    if (opts.includeHashtags) {
      lines.push(``);
      lines.push(`#CongNghe #Tech #AI #TinTuc #XuHuong`);
    }

    return lines.join("\n");
  }
}

/**
 * Create a Viral Hunter service instance
 */
export function createViralHunter(apiKey?: string): ViralHunterService {
  const client = createPerplexityClient(apiKey);
  return new ViralHunterService(client);
}
