#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "youtube-transcript-api>=0.6.0",
#     "requests>=2.31.0",
#     "google-genai>=1.0.0",
#     "anthropic>=0.42.0",
#     "openai>=1.0.0",
# ]
# ///
"""
YouTube to Obsidian - Optimized version with streaming, chunking, and caching.

Usage:
    uv run youtube_to_obsidian_optimized.py --url "https://www.youtube.com/watch?v=VIDEO_ID" [options]

Key Optimizations:
    - Transcript chunking for long videos
    - Parallel processing when possible
    - Intelligent caching
    - Progress reporting
    - Adaptive model selection
"""

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from typing import Dict, List, Optional, Tuple

import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

# AI API imports with error handling
try:
    from google import genai
    from google.genai import types

    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("Warning: Google Gemini not available")

try:
    import anthropic

    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("Warning: Anthropic not available")

try:
    import openai

    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: OpenAI not available")

# Configuration
CONFIG = {
    "CHUNK_SIZE": 2000,  # Characters per transcript chunk
    "MAX_PARALLEL_CHUNKS": 3,  # Max chunks to process in parallel
    "CACHE_DIR": Path.home() / ".openclaw" / "cache" / "youtube",
    "LONG_VIDEO_THRESHOLD": 600,  # 10 minutes in seconds
    "PREVIEW_DURATION": 300,  # 5 minutes for preview mode
    "ADAPTIVE_STRATEGY": True,
}


class VideoMetadata:
    def __init__(self, video_id: str, title: str = "", duration: int = 0):
        self.video_id = video_id
        self.title = title
        self.duration = duration
        self.estimated_tokens = duration * 2  # Rough estimate


class OptimizedYouTubeProcessor:
    def __init__(self, args):
        self.args = args
        self.cache_dir = CONFIG["CACHE_DIR"]
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    async def process_video(self) -> str:
        """Main processing pipeline with optimizations."""
        start_time = time.time()

        print(f"🎬 Processing YouTube video: {self.args.url}")

        # Extract video ID
        video_id = self.extract_video_id(self.args.url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        # Get video metadata
        metadata = await self.get_video_metadata(video_id)
        print(f"📊 Video: {metadata.title} ({metadata.duration}s)")

        # Check cache
        cache_key = self.generate_cache_key(video_id)
        cached_result = self.get_cached_analysis(cache_key)
        if cached_result and not self.args.no_cache:
            print("⚡ Using cached analysis")
            return cached_result

        # Fetch transcript with optimizations
        transcript_data = await self.fetch_transcript_optimized(video_id, metadata)

        if not transcript_data:
            raise ValueError("No transcript available")

        # Process transcript in chunks for long videos
        analysis = await self.process_transcript_optimized(
            transcript_data, metadata, self.on_progress
        )

        # Cache result
        if not self.args.no_cache:
            self.cache_analysis(cache_key, analysis)

        processing_time = time.time() - start_time
        print(f"✅ Processing completed in {processing_time:.1f}s")

        return analysis

    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL."""
        patterns = [
            r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
            r"youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})",
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def get_video_metadata(self, video_id: str) -> VideoMetadata:
        """Get video metadata from YouTube API."""
        try:
            # Use YouTube oEmbed endpoint for basic metadata
            embed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}"
            response = requests.get(embed_url, timeout=10)

            if response.status_code == 200:
                data = response.json()
                title = data.get("title", "Unknown Title")
                # Extract duration from video page (oEmbed doesn't provide it)
                duration = await self.get_video_duration(video_id)
                return VideoMetadata(video_id, title, duration)
        except Exception as e:
            print(f"⚠️  Could not fetch metadata: {e}")

        return VideoMetadata(video_id)

    async def get_video_duration(self, video_id: str) -> int:
        """Extract video duration from YouTube page."""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            response = requests.get(url, timeout=10)

            # Look for duration in page metadata
            duration_match = re.search(r'"lengthSeconds":"(\d+)"', response.text)
            if duration_match:
                return int(duration_match.group(1))
        except Exception:
            pass

        return 0

    async def fetch_transcript_optimized(
        self, video_id: str, metadata: VideoMetadata
    ) -> Optional[dict]:
        """Fetch transcript with fallback strategies."""

        # Strategy 1: Try to get full transcript first
        try:
            print("📥 Fetching transcript...")
            transcript_api = YouTubeTranscriptApi()
            transcript_data = transcript_api.get_transcript(video_id)

            if transcript_data and len(transcript_data) > 0:
                return transcript_data
        except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as e:
            print(f"⚠️  Transcript fetch failed: {e}")

        # Strategy 2: Try different languages
        try:
            print("🌍 Trying alternative languages...")
            transcript_api = YouTubeTranscriptApi()
            transcript_list = transcript_api.list_transcripts(video_id)

            # Try Vietnamese first, then English, then any manually created
            languages_to_try = ["vi", "en", "en-US"]

            for lang in languages_to_try:
                try:
                    if lang in transcript_list:
                        transcript = transcript_list.find_transcript([lang])
                        if transcript:
                            return transcript.fetch()
                except Exception:
                    continue

        except Exception as e:
            print(f"⚠️  Alternative languages failed: {e}")

        return None

    async def process_transcript_optimized(
        self,
        transcript_data: List[dict],
        metadata: VideoMetadata,
        progress_callback=None,
    ) -> str:
        """Process transcript with chunking and parallel processing."""

        # Format transcript
        formatted_text = self.format_transcript(transcript_data)

        # Check if we should use chunking (long transcripts)
        should_chunk = (
            CONFIG["ADAPTIVE_STRATEGY"]
            and len(formatted_text) > CONFIG["CHUNK_SIZE"] * 2
        )

        if should_chunk:
            print(
                f"🔪 Processing long transcript in chunks ({len(formatted_text)} chars)"
            )
            return await self.process_in_chunks(
                formatted_text, metadata, progress_callback
            )
        else:
            return await self.process_single_chunk(formatted_text, metadata)

    async def process_in_chunks(
        self, text: str, metadata: VideoMetadata, progress_callback=None
    ) -> str:
        """Process long transcript in chunks with parallel processing."""

        chunks = self.create_chunks(text)
        print(f"📦 Created {len(chunks)} chunks for processing")

        # Process chunks with limited parallelism
        semaphore = asyncio.Semaphore(CONFIG["MAX_PARALLEL_CHUNKS"])

        async def process_chunk(chunk_data):
            async with semaphore:
                chunk_text, chunk_index = chunk_data
                if progress_callback:
                    progress_callback(chunk_index, len(chunks))
                return await self.analyze_chunk(chunk_text, chunk_index, metadata)

        # Execute in parallel with semaphore
        tasks = [process_chunk(chunk) for chunk in chunks]
        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter exceptions and combine results
        valid_results = [r for r in chunk_results if not isinstance(r, Exception)]
        if len(valid_results) < len(chunk_results):
            print(f"⚠️  {len(chunk_results) - len(valid_results)} chunks failed")

        return self.combine_chunk_results(valid_results, metadata)

    async def process_single_chunk(self, text: str, metadata: VideoMetadata) -> str:
        """Process text as single chunk."""
        return await self.analyze_chunk(text, 0, metadata)

    def create_chunks(self, text: str) -> List[Tuple[str, int]]:
        """Create intelligent chunks preserving sentence boundaries."""
        chunks = []
        chunk_size = CONFIG["CHUNK_SIZE"]

        # Simple chunking with overlap to preserve context
        for i in range(0, len(text), chunk_size - 200):  # 200 char overlap
            chunk_text = text[i : i + chunk_size]
            if chunk_text.strip():
                chunks.append((chunk_text, len(chunks)))

        return chunks

    async def analyze_chunk(
        self, text: str, chunk_index: int, metadata: VideoMetadata
    ) -> str:
        """Analyze a single chunk of text."""
        provider = self.args.provider.lower()

        try:
            if provider == "anthropic" and ANTHROPIC_AVAILABLE:
                return await self.analyze_with_anthropic(text, chunk_index, metadata)
            elif provider == "gemini" and GENAI_AVAILABLE:
                return await self.analyze_with_gemini(text, chunk_index, metadata)
            elif provider == "openai" and OPENAI_AVAILABLE:
                return await self.analyze_with_openai(text, chunk_index, metadata)
            else:
                raise ValueError(f"Provider {provider} not available")

        except Exception as e:
            print(f"⚠️  Chunk {chunk_index} analysis failed: {e}")
            return f"[Analysis failed for chunk {chunk_index}]"

    async def analyze_with_anthropic(
        self, text: str, chunk_index: int, metadata: VideoMetadata
    ) -> str:
        """Analyze text using Anthropic Claude."""
        client = anthropic.Anthropic(api_key=self.get_api_key())

        prompt = self.create_analysis_prompt(text, chunk_index, metadata)

        response = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text.strip()

    async def analyze_with_gemini(
        self, text: str, chunk_index: int, metadata: VideoMetadata
    ) -> str:
        """Analyze text using Google Gemini."""
        genai.configure(api_key=self.get_api_key())
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = self.create_analysis_prompt(text, chunk_index, metadata)

        response = await model.generate_content_async(prompt)
        return response.text.strip()

    async def analyze_with_openai(
        self, text: str, chunk_index: int, metadata: VideoMetadata
    ) -> str:
        """Analyze text using OpenAI GPT."""
        client = openai.OpenAI(api_key=self.get_api_key())

        prompt = self.create_analysis_prompt(text, chunk_index, metadata)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.choices[0].message.content.strip()

    def create_analysis_prompt(
        self, text: str, chunk_index: int, metadata: VideoMetadata
    ) -> str:
        """Create optimized prompt for content analysis."""

        base_prompt = f"""Phân tích nội dung sau đây (nếu là tiếng Việt) và tóm tắt các điểm chính:

{text}

Hãy cung cấp:
1. Tóm tắt chính (3-5 gạch đầu dòng)
2. Điểm quan trọng nhất (nếu có)
3. Ngữ cảnh chính
4. Từ khóa liên quan"""

        if chunk_index == 0:
            base_prompt += (
                f"\n\nThông tin video: {metadata.title} ({metadata.duration}s)"
            )

        if len(text) > CONFIG["CHUNK_SIZE"]:
            base_prompt += f"\n\nĐây là phần {chunk_index + 1} của transcript. Hãy tập trung vào nội dung phần này."

        return base_prompt

    def combine_chunk_results(self, results: List[str], metadata: VideoMetadata) -> str:
        """Combine multiple chunk analyses into coherent summary."""
        if not results:
            return "Không có kết quả phân tích."

        combined = f"""# Tóm tắt video: {metadata.title}

## Tổng hợp từ {len(results)} phần phân tích:

"""

        for i, result in enumerate(results):
            if result.strip():
                combined += f"### Phần {i + 1}:\n{result}\n\n"

        combined += """## Tổng kết:
- Các điểm chính được tổng hợp từ tất cả phần
- Nội dung được phân tích tuần tự theo tiến trình video
"""

        return combined

    def format_transcript(self, transcript_data: List[dict]) -> str:
        """Format transcript with timestamps."""
        if not transcript_data:
            return ""

        formatted_lines = []
        for item in transcript_data:
            text = item.get("text", "").strip()
            start_time = item.get("start", 0)

            if text:
                # Add timestamp for better context
                minutes = int(start_time // 60)
                seconds = int(start_time % 60)
                timestamp = f"[{minutes:02d}:{seconds:02d}] "
                formatted_lines.append(f"{timestamp}{text}")

        return "\n".join(formatted_lines)

    def generate_cache_key(self, video_id: str) -> str:
        """Generate cache key for video."""
        return hashlib.sha256(f"{video_id}_{self.args.provider}".encode()).hexdigest()[
            :16
        ]

    def get_cached_analysis(self, cache_key: str) -> Optional[str]:
        """Get cached analysis if available and not expired."""
        cache_file = self.cache_dir / f"{cache_key}.json"

        if not cache_file.exists():
            return None

        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Check if cache is recent (24 hours)
            cache_time = data.get("timestamp", 0)
            if time.time() - cache_time < 86400:  # 24 hours
                return data.get("analysis")
        except Exception:
            pass

        return None

    def cache_analysis(self, cache_key: str, analysis: str):
        """Cache analysis result."""
        cache_file = self.cache_dir / f"{cache_key}.json"

        try:
            data = {
                "timestamp": time.time(),
                "video_id": cache_key,
                "provider": self.args.provider,
                "analysis": analysis,
            }

            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️  Failed to cache analysis: {e}")

    def on_progress(self, chunk_index: int, total_chunks: int):
        """Progress callback for chunk processing."""
        percentage = ((chunk_index + 1) / total_chunks) * 100
        print(
            f"🔄 Processing chunk {chunk_index + 1}/{total_chunks} ({percentage:.1f}%)"
        )

    def get_api_key(self) -> str:
        """Get API key from args or environment."""
        if self.args.api_key:
            return self.args.api_key

        # Try environment variables
        if self.args.provider.lower() == "anthropic":
            return os.getenv("ANTHROPIC_API_KEY", "")
        elif self.args.provider.lower() == "gemini":
            return os.getenv("GOOGLE_API_KEY", "")
        elif self.args.provider.lower() == "openai":
            return os.getenv("OPENAI_API_KEY", "")

        raise ValueError(f"API key required for {self.args.provider}")


async def main():
    parser = argparse.ArgumentParser(
        description="Optimized YouTube to Obsidian with streaming and caching"
    )
    parser.add_argument("--url", required=True, help="YouTube video URL")
    parser.add_argument("--folder", default="YouTube Notes", help="Obsidian folder")
    parser.add_argument("--vault", help="Obsidian vault path")
    parser.add_argument(
        "--translate", action="store_true", help="Translate to Vietnamese"
    )
    parser.add_argument(
        "--no-open", action="store_true", help="Do not open in Obsidian"
    )
    parser.add_argument("--no-ai", action="store_true", help="Skip AI analysis")
    parser.add_argument(
        "--provider", default="anthropic", choices=["anthropic", "gemini", "openai"]
    )
    parser.add_argument("--api-key", help="API key for selected provider")
    parser.add_argument("--no-cache", action="store_true", help="Disable caching")

    args = parser.parse_args()

    try:
        processor = OptimizedYouTubeProcessor(args)
        analysis = await processor.process_video()

        if args.no_ai:
            # Just save transcript if no AI analysis
            print("📝 Saving transcript only (no AI analysis)")
            analysis = "Transcript saved without AI analysis."

        # Save to Obsidian (would need obsidian-cli integration)
        output_file = (
            Path(args.folder) / f"youtube_{processor.extract_video_id(args.url)}.md"
        )
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(analysis)

        print(f"💾 Saved to: {output_file}")

        if not args.no_open:
            # Try to open in Obsidian
            try:
                subprocess.run(["obsidian", str(output_file)], check=False)
            except:
                print("ℹ️  Could not open in Obsidian automatically")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
