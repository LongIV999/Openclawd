import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { VideoMetadata, VideoChunk, ProcessingStrategy } from "./video-processor.js";

export type VideoCacheEntry = {
  id: string;
  metadata: VideoMetadata;
  chunks: VideoChunk[];
  analysis?: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  processingStrategy: ProcessingStrategy;
  size: number;
};

export type VideoCacheConfig = {
  enabled: boolean;
  storage: {
    type: "memory" | "disk" | "hybrid";
    path: string;
    maxSize: number; // MB
    maxEntries: number;
  };
  ttl: {
    metadata: number; // days
    chunks: number; // days
    analysis: number; // days
  };
  compression: {
    enabled: boolean;
    level: number; // 0-9
  };
};

export class VideoContentCache {
  private config: VideoCacheConfig;
  private memoryCache: Map<string, VideoCacheEntry> = new Map();
  private storagePath: string;

  constructor(config?: Partial<VideoCacheConfig>) {
    this.config = {
      enabled: true,
      storage: {
        type: "hybrid",
        path: "~/.openclaw/cache/video",
        maxSize: 500, // 500MB
        maxEntries: 100,
      },
      ttl: {
        metadata: 30, // 30 days
        chunks: 7, // 7 days
        analysis: 30, // 30 days
      },
      compression: {
        enabled: true,
        level: 6,
      },
      ...config,
    };

    this.storagePath = this.config.storage.path.replace("~", process.env.HOME || "~");
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(videoId);
    if (memoryEntry) {
      memoryEntry.lastAccessed = new Date();
      memoryEntry.accessCount++;
      return memoryEntry.metadata;
    }

    // Check disk cache
    if (this.config.storage.type !== "memory") {
      const diskEntry = await this.getDiskCacheEntry(videoId);
      if (diskEntry) {
        // Load into memory for future access
        this.memoryCache.set(videoId, diskEntry);
        return diskEntry.metadata;
      }
    }

    return null;
  }

  async getVideoAnalysis(videoId: string): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    const entry = await this.getCacheEntry(videoId);
    return entry?.analysis || null;
  }

  async getVideoChunks(videoId: string, chunkIndices?: number[]): Promise<VideoChunk[] | null> {
    if (!this.config.enabled) {
      return null;
    }

    const entry = await this.getCacheEntry(videoId);
    if (!entry) {
      return null;
    }

    if (!chunkIndices) {
      return entry.chunks;
    }

    return entry.chunks.filter((_, index) => chunkIndices.includes(index));
  }

  async setVideoMetadata(videoId: string, metadata: VideoMetadata): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const existingEntry = await this.getCacheEntry(videoId);
    const entry: VideoCacheEntry = existingEntry || {
      id: videoId,
      metadata,
      chunks: [],
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      processingStrategy: "full",
      size: 0,
    };

    entry.metadata = metadata;
    entry.lastAccessed = new Date();

    await this.saveCacheEntry(entry);
  }

  async setVideoChunks(
    videoId: string,
    chunks: VideoChunk[],
    processingStrategy: ProcessingStrategy,
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const entry = await this.getCacheEntry(videoId);
    if (!entry) {
      throw new Error(`Video metadata not found for ID: ${videoId}`);
    }

    entry.chunks = chunks;
    entry.processingStrategy = processingStrategy;
    entry.size = chunks.reduce((total, chunk) => total + chunk.size, 0);
    entry.lastAccessed = new Date();

    await this.saveCacheEntry(entry);
  }

  async setVideoAnalysis(videoId: string, analysis: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const entry = await this.getCacheEntry(videoId);
    if (!entry) {
      throw new Error(`Video not found for ID: ${videoId}`);
    }

    entry.analysis = analysis;
    entry.lastAccessed = new Date();

    await this.saveCacheEntry(entry);
  }

  async invalidateVideo(videoId: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(videoId);

    // Remove from disk
    if (this.config.storage.type !== "memory") {
      const metadataPath = this.getMetadataPath(videoId);
      const chunksPath = this.getChunksPath(videoId);
      const analysisPath = this.getAnalysisPath(videoId);

      [metadataPath, chunksPath, analysisPath].forEach((path) => {
        if (existsSync(path)) {
          unlinkSync(path);
        }
      });
    }
  }

  async clearExpired(): Promise<void> {
    const now = new Date();
    const entries = await this.getAllCacheEntries();

    for (const entry of entries) {
      const metadataAge = this.getDaysDiff(entry.createdAt, now);
      const accessAge = this.getDaysDiff(entry.lastAccessed, now);

      // Check expiration criteria
      const isMetadataExpired = metadataAge > this.config.ttl.metadata;
      const isStale = accessAge > this.config.ttl.chunks && entry.accessCount < 2;

      if (isMetadataExpired || isStale) {
        await this.invalidateVideo(entry.id);
      }
    }
  }

  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    memoryEntries: number;
    diskEntries: number;
    hitRate?: number;
    totalAccesses: number;
  }> {
    const entries = await this.getAllCacheEntries();
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);

    return {
      totalEntries: entries.length,
      totalSize,
      memoryEntries: this.memoryCache.size,
      diskEntries:
        this.config.storage.type !== "memory" ? entries.length - this.memoryCache.size : 0,
      totalAccesses,
    };
  }

  private async getCacheEntry(videoId: string): Promise<VideoCacheEntry | null> {
    // Check memory cache
    const memoryEntry = this.memoryCache.get(videoId);
    if (memoryEntry) {
      memoryEntry.lastAccessed = new Date();
      memoryEntry.accessCount++;
      return memoryEntry;
    }

    // Check disk cache
    if (this.config.storage.type !== "memory") {
      const diskEntry = await this.getDiskCacheEntry(videoId);
      if (diskEntry) {
        // Load into memory if we have space
        if (this.memoryCache.size < this.config.storage.maxEntries / 2) {
          this.memoryCache.set(videoId, diskEntry);
        }
        return diskEntry;
      }
    }

    return null;
  }

  private async getDiskCacheEntry(videoId: string): Promise<VideoCacheEntry | null> {
    const metadataPath = this.getMetadataPath(videoId);

    if (!existsSync(metadataPath)) {
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(metadataPath, "utf-8"));
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        lastAccessed: new Date(data.lastAccessed),
      };
    } catch {
      // Corrupted file, remove it
      try {
        unlinkSync(metadataPath);
      } catch {
        // Ignore
      }
      return null;
    }
  }

  private async saveCacheEntry(entry: VideoCacheEntry): Promise<void> {
    // Save to memory
    this.memoryCache.set(entry.id, entry);

    // Save to disk if not memory-only
    if (this.config.storage.type !== "memory") {
      await this.saveDiskCacheEntry(entry);
    }

    // Enforce cache limits
    await this.enforceCacheLimits();
  }

  private async saveDiskCacheEntry(entry: VideoCacheEntry): Promise<void> {
    const metadataPath = this.getMetadataPath(entry.id);
    const chunksPath = this.getChunksPath(entry.id);
    const analysisPath = this.getAnalysisPath(entry.id);

    // Save metadata
    writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          id: entry.id,
          metadata: entry.metadata,
          processingStrategy: entry.processingStrategy,
          createdAt: entry.createdAt.toISOString(),
          lastAccessed: entry.lastAccessed.toISOString(),
          accessCount: entry.accessCount,
          size: entry.size,
        },
        null,
        2,
      ),
    );

    // Save chunks
    writeFileSync(chunksPath, JSON.stringify(entry.chunks, null, 2));

    // Save analysis if available
    if (entry.analysis) {
      writeFileSync(analysisPath, entry.analysis);
    }
  }

  private getMetadataPath(videoId: string): string {
    return join(this.storagePath, `${videoId}.metadata.json`);
  }

  private getChunksPath(videoId: string): string {
    return join(this.storagePath, `${videoId}.chunks.json`);
  }

  private getAnalysisPath(videoId: string): string {
    return join(this.storagePath, `${videoId}.analysis.txt`);
  }

  private async getAllCacheEntries(): Promise<VideoCacheEntry[]> {
    const entries: VideoCacheEntry[] = [];

    // Add memory entries
    entries.push(...Array.from(this.memoryCache.values()));

    // Add disk entries (avoid duplicates)
    if (this.config.storage.type !== "memory") {
      const diskEntries = await this.getDiskCacheEntries();
      for (const diskEntry of diskEntries) {
        if (!this.memoryCache.has(diskEntry.id)) {
          entries.push(diskEntry);
        }
      }
    }

    return entries;
  }

  private async getDiskCacheEntries(): Promise<VideoCacheEntry[]> {
    const entries: VideoCacheEntry[] = [];

    try {
      const { readdirSync } = require("node:fs");
      const files = readdirSync(this.storagePath);

      for (const file of files) {
        if (file.endsWith(".metadata.json")) {
          const videoId = file.replace(".metadata.json", "");
          const entry = await this.getDiskCacheEntry(videoId);
          if (entry) {
            entries.push(entry);
          }
        }
      }
    } catch {
      // Return empty array on error
    }

    return entries;
  }

  private async enforceCacheLimits(): Promise<void> {
    const entries = await this.getAllCacheEntries();

    // Enforce max entries
    if (entries.length > this.config.storage.maxEntries) {
      // Sort by last accessed (oldest first)
      const sortedEntries = entries.toSorted(
        (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
      );

      // Remove oldest entries
      const toRemove = sortedEntries.slice(0, entries.length - this.config.storage.maxEntries);
      for (const entry of toRemove) {
        await this.invalidateVideo(entry.id);
      }
    }

    // Enforce max size
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const maxSizeBytes = this.config.storage.maxSize * 1024 * 1024;

    if (totalSize > maxSizeBytes) {
      // Sort by size (largest first) and remove until under limit
      const sortedBySize = entries.toSorted((a, b) => b.size - a.size);
      let currentSize = totalSize;

      for (const entry of sortedBySize) {
        if (currentSize <= maxSizeBytes) {
          break;
        }

        await this.invalidateVideo(entry.id);
        currentSize -= entry.size;
      }
    }
  }

  private getDaysDiff(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.abs(date2.getTime() - date1.getTime()) / msPerDay;
  }

  // Utility method to generate cache keys
  static generateVideoKey(url: string, quality?: string): string {
    const keyString = `${url}${quality ? `:${quality}` : ""}`;
    return createHash("sha256").update(keyString).digest("hex").substring(0, 16);
  }
}
