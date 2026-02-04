export interface PerplexityConfig {
  /** Perplexity API Key */
  apiKey?: string;
  /** Default settings for Perplexity client */
  defaults?: {
    /** Model to use (default: sonar-pro) */
    model?: string;
    /** Max tokens for response (default: 4096) */
    maxTokens?: number;
  };
}
