/**
 * Perplexity API Client for Viral Content Hunter
 *
 * Uses Perplexity's Sonar Pro model for real-time web search
 * with focus on social media platforms (X, Reddit, Threads)
 */

import { getChildLogger } from "../../logging.js";

const logger = getChildLogger({ module: "perplexity-client" });

// Types
export interface PerplexityOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface PerplexityCitation {
  url: string;
  title?: string;
  snippet?: string;
}

export interface PerplexityResponse {
  content: string;
  citations: PerplexityCitation[];
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SearchOptions {
  searchDomainFilter?: string[];
  searchRecencyFilter?: "day" | "week" | "month" | "year";
  returnCitations?: boolean;
  returnImages?: boolean;
}

// Constants
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_MODEL = "sonar-pro"; // Best for complex queries with citations
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2; // Lower for more factual responses

/**
 * Perplexity API Client
 */
export class PerplexityClient {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: PerplexityOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;

    if (!this.apiKey) {
      throw new Error("Perplexity API key is required");
    }
  }

  /**
   * Send a chat completion request to Perplexity API
   */
  async chat(messages: ChatMessage[], options?: SearchOptions): Promise<PerplexityResponse> {
    const body = {
      model: this.model,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      return_citations: options?.returnCitations ?? true,
      return_images: options?.returnImages ?? false,
      ...(options?.searchDomainFilter && {
        search_domain_filter: options.searchDomainFilter,
      }),
      ...(options?.searchRecencyFilter && {
        search_recency_filter: options.searchRecencyFilter,
      }),
    };

    logger.debug("Perplexity request", { model: this.model, messageCount: messages.length });

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      logger.error("Perplexity API error", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    const result: PerplexityResponse = {
      content: data.choices?.[0]?.message?.content ?? "",
      citations: this.extractCitations(data),
      model: data.model ?? this.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };

    logger.debug("Perplexity response", {
      contentLength: result.content.length,
      citationsCount: result.citations.length,
      usage: result.usage,
    });

    return result;
  }

  /**
   * Search with specific query and domain filters
   */
  async search(
    query: string,
    options?: SearchOptions & { systemPrompt?: string },
  ): Promise<PerplexityResponse> {
    const messages: ChatMessage[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: query });

    return this.chat(messages, options);
  }

  /**
   * Extract citations from Perplexity API response
   */
  private extractCitations(data: any): PerplexityCitation[] {
    const citations: PerplexityCitation[] = [];

    // Citations can be in different formats depending on the response
    if (data.citations && Array.isArray(data.citations)) {
      for (const citation of data.citations) {
        if (typeof citation === "string") {
          citations.push({ url: citation });
        } else if (typeof citation === "object" && citation.url) {
          citations.push({
            url: citation.url,
            title: citation.title,
            snippet: citation.snippet,
          });
        }
      }
    }

    return citations;
  }
}

/**
 * Create a Perplexity client from environment or config
 */
export function createPerplexityClient(
  apiKey?: string,
  options?: Partial<PerplexityOptions>,
): PerplexityClient {
  const key = apiKey ?? process.env.PERPLEXITY_API_KEY;

  if (!key) {
    throw new Error(
      "Perplexity API key not found. Set PERPLEXITY_API_KEY environment variable or pass apiKey parameter.",
    );
  }

  return new PerplexityClient({
    apiKey: key,
    ...options,
  });
}
