import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedUsage } from "../../agents/usage.js";

export type CachedResponse = {
  response: string;
  usage: NormalizedUsage;
  cost: number;
  timestamp: Date;
  ttl: number;
  hitCount: number;
};

export type CacheConfig = {
  enabled: boolean;
  storage: {
    type: "memory" | "disk";
    path?: string;
    maxSize: number; // Maximum number of cached responses
  };
  ttl: {
    default: number; // Default TTL in seconds
    perModel: Record<string, number>; // Model-specific TTL
  };
  hashing: {
    algorithm: string;
    includeTemperature: boolean;
    includeMaxTokens: boolean;
  };
};

export class ResponseCache {
  private config: CacheConfig;
  private memoryCache: Map<string, CachedResponse> = new Map();
  private storagePath: string = "";

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      enabled: true,
      storage: {
        type: "memory",
        maxSize: 1000,
      },
      ttl: {
        default: 3600, // 1 hour
        perModel: {
          "gpt-4o": 7200, // 2 hours for expensive models
          "claude-3-5-sonnet-20241022": 7200,
          "gpt-4o-mini": 1800, // 30 minutes for cheap models
        },
      },
      hashing: {
        algorithm: "sha256",
        includeTemperature: true,
        includeMaxTokens: true,
      },
      ...config,
    };

    if (this.config.storage.type === "disk") {
      this.storagePath = this.config.storage.path || "~/.openclaw/cache/responses";
      this.storagePath = this.storagePath.replace("~", process.env.HOME || "~");
      if (!existsSync(this.storagePath)) {
        mkdirSync(this.storagePath, { recursive: true });
      }
    }
  }

  async get(cacheKey: string): Promise<CachedResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cached =
      this.config.storage.type === "memory"
        ? this.memoryCache.get(cacheKey)
        : await this.getDiskCache(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp.getTime() > cached.ttl * 1000) {
      await this.delete(cacheKey);
      return null;
    }

    // Update hit count
    cached.hitCount++;
    if (this.config.storage.type === "memory") {
      this.memoryCache.set(cacheKey, cached);
    } else {
      await this.setDiskCache(cacheKey, cached);
    }

    return cached;
  }

  async set(params: {
    key: string;
    response: string;
    usage: NormalizedUsage;
    cost: number;
    ttl?: number;
    temperature?: number;
    maxTokens?: number;
  }): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey({
      prompt: params.key,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    const ttl = params.ttl || this.config.ttl.default;

    const cachedResponse: CachedResponse = {
      response: params.response,
      usage: params.usage,
      cost: params.cost,
      timestamp: new Date(),
      ttl,
      hitCount: 0,
    };

    // Check cache size limit
    if (this.config.storage.type === "memory") {
      if (this.memoryCache.size >= this.config.storage.maxSize) {
        await this.evictOldest();
      }
      this.memoryCache.set(cacheKey, cachedResponse);
    } else {
      await this.setDiskCache(cacheKey, cachedResponse);
      await this.enforceDiskCacheLimit();
    }
  }

  generateCacheKey(params: { prompt: string; temperature?: number; maxTokens?: number }): string {
    let keyString = params.prompt;

    if (this.config.hashing.includeTemperature && params.temperature !== undefined) {
      keyString += `|temp:${params.temperature}`;
    }

    if (this.config.hashing.includeMaxTokens && params.maxTokens !== undefined) {
      keyString += `|max:${params.maxTokens}`;
    }

    return createHash(this.config.hashing.algorithm).update(keyString).digest("hex");
  }

  async clear(): Promise<void> {
    if (this.config.storage.type === "memory") {
      this.memoryCache.clear();
    } else {
      // Clear disk cache
      if (existsSync(this.storagePath)) {
        const files = readFileSync(this.storagePath, "utf-8").split("\n").filter(Boolean);

        for (const file of files) {
          try {
            unlinkSync(join(this.storagePath, file));
          } catch {
            // Skip files that can't be deleted
          }
        }
      }
    }
  }

  async getStats(): Promise<{
    size: number;
    totalHits: number;
    totalCostSaved: number;
    averageHitRate: number;
  }> {
    const cache =
      this.config.storage.type === "memory"
        ? Array.from(this.memoryCache.values())
        : await this.getAllDiskCache();

    const totalHits = cache.reduce((sum, item) => sum + item.hitCount, 0);
    const totalCostSaved = cache.reduce((sum, item) => sum + item.cost * item.hitCount, 0);
    const averageHitRate = cache.length > 0 ? totalHits / cache.length : 0;

    return {
      size: cache.length,
      totalHits,
      totalCostSaved,
      averageHitRate,
    };
  }

  private async getDiskCache(cacheKey: string): Promise<CachedResponse | null> {
    const filePath = join(this.storagePath, `${cacheKey}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      return {
        ...data,
        timestamp: new Date(data.timestamp),
      };
    } catch {
      // File corrupted, delete it
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore deletion error
      }
      return null;
    }
  }

  private async setDiskCache(cacheKey: string, response: CachedResponse): Promise<void> {
    const filePath = join(this.storagePath, `${cacheKey}.json`);
    writeFileSync(filePath, JSON.stringify(response, null, 2));
  }

  private async delete(cacheKey: string): Promise<void> {
    if (this.config.storage.type === "memory") {
      this.memoryCache.delete(cacheKey);
    } else {
      const filePath = join(this.storagePath, `${cacheKey}.json`);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
  }

  private async evictOldest(): Promise<void> {
    if (this.config.storage.type === "memory") {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    } else {
      await this.enforceDiskCacheLimit();
    }
  }

  private async enforceDiskCacheLimit(): Promise<void> {
    const files = this.getDiskCacheFiles();

    if (files.length <= this.config.storage.maxSize) {
      return;
    }

    // Sort files by modification time (oldest first)
    const sortedFiles = files.toSorted((a, b) => a.mtime.getTime() - b.mtime.getTime());

    // Delete oldest files to maintain limit
    const filesToDelete = sortedFiles.slice(0, files.length - this.config.storage.maxSize);

    for (const file of filesToDelete) {
      try {
        unlinkSync(join(this.storagePath, file.name));
      } catch {
        // Skip files that can't be deleted
      }
    }
  }

  private getDiskCacheFiles(): Array<{ name: string; mtime: Date }> {
    if (!existsSync(this.storagePath)) {
      return [];
    }

    try {
      const { readdirSync, statSync } = require("node:fs");
      return readdirSync(this.storagePath)
        .filter((file: string) => file.endsWith(".json"))
        .map((file: string) => ({
          name: file,
          mtime: statSync(join(this.storagePath, file)).mtime,
        }));
    } catch {
      return [];
    }
  }

  private async getAllDiskCache(): Promise<CachedResponse[]> {
    const files = this.getDiskCacheFiles();
    const cache: CachedResponse[] = [];

    for (const file of files) {
      const cached = await this.getDiskCache(file.name.replace(".json", ""));
      if (cached) {
        cache.push(cached);
      }
    }

    return cache;
  }
}
