import type { VideoDescriptionRequest, VideoDescriptionResult } from "../../types.js";
import { describeGeminiVideo } from "./video.js";

// Define required types inline
type ProcessingProgress = {
  totalChunks: number;
  processedChunks: number;
  currentChunk: number;
  percentage: number;
  elapsed: number;
  estimatedTotal: number;
  currentPhase: "downloading" | "analyzing" | "summarizing" | "completed";
};

type ProgressiveResult = {
  isPartial: boolean;
  confidence: number;
  analysis: string;
  metadata: {
    chunksProcessed: number;
    totalChunks: number;
    processingStrategy: "full" | "preview" | "adaptive";
  };
};

type VideoMetadata = {
  id: string;
  duration: number;
  resolution: string;
  size: number;
  format: string;
  url?: string;
};

interface OptimizedVideoDescriptionRequest extends VideoDescriptionRequest {
  enableStreaming?: boolean;
  enableCaching?: boolean;
  onProgress?: (progress: ProcessingProgress) => void;
  onPartialResult?: (result: ProgressiveResult) => void;
  processingStrategy?: "full" | "preview" | "adaptive";
}

interface VideoChunk {
  index: number;
  data: Buffer;
  duration: number;
  timestamp: number;
  size: number;
}

interface CacheEntry {
  id: string;
  metadata: VideoMetadata;
  analysis?: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
}

export class OptimizedVideoProvider {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize = 50; // Max entries in memory

  async describeVideoOptimized(
    params: OptimizedVideoDescriptionRequest,
  ): Promise<VideoDescriptionResult> {
    const startTime = Date.now();

    // Generate cache key from video content
    const videoId = this.generateVideoId(params.buffer);

    // Check cache first
    if (params.enableCaching !== false) {
      const cached = this.getCachedResult(videoId);
      if (cached) {
        return {
          text: cached.analysis || "",
          model: params.model || "gemini-3-flash-preview",
        };
      }
    }

    // Extract basic metadata
    const metadata = this.extractVideoMetadata(params.buffer, videoId);

    // Determine processing strategy
    const strategy = params.processingStrategy || this.determineStrategy(metadata);

    // Update initial progress
    if (params.onProgress) {
      params.onProgress({
        totalChunks: 1,
        processedChunks: 0,
        currentChunk: 0,
        percentage: 0,
        elapsed: Date.now() - startTime,
        estimatedTotal: this.getEstimatedTimeout(metadata, strategy),
        currentPhase: "downloading",
      });
    }

    try {
      let result: string;

      if (params.enableStreaming && strategy === "full") {
        // Use chunked processing for better UX
        result = await this.processVideoInChunks(
          params,
          metadata,
          videoId,
          params.onProgress,
          params.onPartialResult,
        );
      } else {
        // Use optimized single processing
        result = await this.processVideoSingle(params, metadata, strategy, params.onProgress);
      }

      // Cache the result
      if (params.enableCaching !== false) {
        this.cacheResult(videoId, metadata, result);
      }

      return {
        text: result,
        model: params.model || "gemini-3-flash-preview",
      };
    } catch (error) {
      // Fallback to original implementation if optimization fails
      console.warn("Optimized video processing failed, falling back to standard:", error);
      return await describeGeminiVideo(params);
    }
  }

  private async processVideoInChunks(
    params: VideoDescriptionRequest,
    metadata: VideoMetadata,
    videoId: string,
    onProgress?: (progress: ProcessingProgress) => void,
    onPartialResult?: (result: ProgressiveResult) => void,
  ): Promise<string> {
    // Create chunks based on video duration
    const chunks = this.createVideoChunks(params.buffer, metadata);
    const analyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Update progress
      if (onProgress) {
        onProgress({
          totalChunks: chunks.length,
          processedChunks: analyses.length,
          currentChunk: i,
          percentage: (i / chunks.length) * 100,
          elapsed: Date.now() - Date.now(), // Will be calculated properly
          estimatedTotal: this.getEstimatedTimeout(metadata, "full"),
          currentPhase: "analyzing",
        });
      }

      // Process chunk with smaller timeout
      const chunkResult = await this.processVideoChunk(chunk, params);
      analyses.push(chunkResult);

      // Emit partial result after a few chunks
      if (onPartialResult && i >= 1) {
        const partialAnalysis = this.generatePartialAnalysis(analyses, metadata, i, chunks.length);
        onPartialResult({
          isPartial: true,
          confidence: Math.min(0.8, (i + 1) / chunks.length),
          analysis: partialAnalysis,
          metadata: {
            chunksProcessed: i + 1,
            totalChunks: chunks.length,
            processingStrategy: "full",
          },
        });
      }
    }

    return this.generateFinalAnalysis(analyses, metadata);
  }

  private async processVideoSingle(
    params: VideoDescriptionRequest,
    metadata: VideoMetadata,
    strategy: "full" | "preview" | "adaptive",
    onProgress?: (progress: ProcessingProgress) => void,
  ): Promise<string> {
    // For preview mode, use smaller buffer
    let processedBuffer = params.buffer;

    if (strategy === "preview") {
      // Use only first part of video for preview
      const previewSize = Math.min(params.buffer.length, 10 * 1024 * 1024); // Max 10MB for preview
      processedBuffer = params.buffer.slice(0, previewSize);
    }

    // Update progress
    if (onProgress) {
      onProgress({
        totalChunks: 1,
        processedChunks: 0,
        currentChunk: 0,
        percentage: 50,
        elapsed: Date.now() - Date.now(),
        estimatedTotal: this.getEstimatedTimeout(metadata, strategy),
        currentPhase: "analyzing",
      });
    }

    // Process with optimized timeout
    const optimizedParams: VideoDescriptionRequest = {
      ...params,
      buffer: processedBuffer,
      timeoutMs: Math.min(params.timeoutMs || 60000, this.getEstimatedTimeout(metadata, strategy)),
    };

    const result = await describeGeminiVideo(optimizedParams);

    if (strategy === "preview") {
      return `[PREVIEW MODE] ${result.text}\n\n[This is a preview analysis of the first ${Math.round(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, "0")} of the video]`;
    }

    return result.text;
  }

  private generateVideoId(buffer: Buffer): string {
    // Generate a hash of the video content for caching
    const crypto = require("node:crypto");
    return crypto.createHash("sha256").update(buffer).digest("hex").substring(0, 16);
  }

  private extractVideoMetadata(buffer: Buffer, videoId: string): VideoMetadata {
    // Basic metadata estimation based on buffer size
    const estimatedDuration = Math.max(60, (buffer.length / (1024 * 1024)) * 10); // Rough estimate

    return {
      id: videoId,
      duration: estimatedDuration,
      resolution: "unknown",
      size: buffer.length,
      format: "mp4",
    };
  }

  private determineStrategy(metadata: VideoMetadata): "full" | "preview" | "adaptive" {
    // Use preview for very long videos (>30 minutes)
    if (metadata.duration > 1800) {
      return "preview";
    }

    // Use preview for very large files (>50MB)
    if (metadata.size > 50 * 1024 * 1024) {
      return "preview";
    }

    return "full";
  }

  private getEstimatedTimeout(
    metadata: VideoMetadata,
    strategy: "full" | "preview" | "adaptive",
  ): number {
    const baseTimeout = 120000; // 2 minutes base

    switch (strategy) {
      case "preview":
        return 60000; // 1 minute for preview
      case "full":
        return Math.min(baseTimeout, metadata.duration * 1000); // 1 second per video second max
      case "adaptive":
        return metadata.duration > 1800 ? 60000 : baseTimeout;
      default:
        return baseTimeout;
    }
  }

  private createVideoChunks(buffer: Buffer, metadata: VideoMetadata): VideoChunk[] {
    const chunks: VideoChunk[] = [];
    const chunkDuration = Math.min(30, metadata.duration); // Max 30 seconds per chunk

    const totalChunks = Math.ceil(metadata.duration / chunkDuration);

    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * chunkDuration;
      const endTime = Math.min(startTime + chunkDuration, metadata.duration);
      const chunkRatio = (endTime - startTime) / metadata.duration;
      const chunkSize = Math.floor(buffer.length * chunkRatio);
      const startPos = Math.floor(buffer.length * (startTime / metadata.duration));

      chunks.push({
        index: i,
        data: buffer.slice(startPos, Math.min(startPos + chunkSize, buffer.length)),
        duration: endTime - startTime,
        timestamp: startTime,
        size: Math.floor(chunkSize),
      });
    }

    return chunks;
  }

  private async processVideoChunk(
    chunk: VideoChunk,
    params: VideoDescriptionRequest,
  ): Promise<string> {
    // Create chunk-specific request
    const chunkParams: VideoDescriptionRequest = {
      ...params,
      buffer: chunk.data,
      timeoutMs: Math.min(params.timeoutMs || 60000, 30000), // 30 second timeout for chunks
      prompt: params.prompt
        ? `${params.prompt} (Video segment ${chunk.index + 1}, ${chunk.duration}s)`
        : undefined,
    };

    const result = await describeGeminiVideo(chunkParams);
    return result.text;
  }

  private generatePartialAnalysis(
    analyses: string[],
    metadata: VideoMetadata,
    currentChunk: number,
    totalChunks: number,
  ): string {
    const processedDuration = (currentChunk + 1) * (metadata.duration / totalChunks);
    const percentage = ((currentChunk + 1) / totalChunks) * 100;

    return (
      `Partial analysis (${Math.round(percentage)}% complete, ${Math.round(processedDuration)}s analyzed):\n\n` +
      analyses.join("\n\n") +
      `\n\n[Processing continues... ${totalChunks - currentChunk - 1} segments remaining]`
    );
  }

  private generateFinalAnalysis(analyses: string[], metadata: VideoMetadata): string {
    return (
      `Complete video analysis (${Math.round(metadata.duration)}s total duration):\n\n` +
      analyses.join("\n\n")
    );
  }

  private getCachedResult(videoId: string): CacheEntry | null {
    const cached = this.cache.get(videoId);
    if (cached) {
      cached.lastAccessed = new Date();
      cached.accessCount++;
      return cached;
    }
    return null;
  }

  private cacheResult(videoId: string, metadata: VideoMetadata, analysis: string): void {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      let oldestKey = "";
      let oldestTime = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed.getTime() < oldestTime) {
          oldestTime = entry.lastAccessed.getTime();
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    // Add new entry
    this.cache.set(videoId, {
      id: videoId,
      metadata,
      analysis,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      size: metadata.size,
    });
  }

  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    memoryUsage: number;
  }> {
    let totalAccesses = 0;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      totalSize += entry.size;
    }

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalAccesses > 0 ? (totalAccesses - this.cache.size) / totalAccesses : 0,
      memoryUsage: this.cache.size,
    };
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
  }
}

// Export the optimized function to replace the original
export const describeGeminiVideoOptimized = (
  params: OptimizedVideoDescriptionRequest,
): Promise<VideoDescriptionResult> => {
  const provider = new OptimizedVideoProvider();
  return provider.describeVideoOptimized(params);
};
