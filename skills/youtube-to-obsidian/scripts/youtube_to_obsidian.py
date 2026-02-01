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
YouTube to Obsidian - Lấy transcript từ YouTube, phân tích với AI và lưu vào Obsidian vault.

Usage:
    uv run youtube_to_obsidian.py --url "https://www.youtube.com/watch?v=VIDEO_ID" [options]

Options:
    --url URL           YouTube video URL (required)
    --folder FOLDER     Folder trong Obsidian vault để lưu note (default: "YouTube Notes")
    --vault PATH        Đường dẫn tới Obsidian vault (default: sử dụng obsidian-cli default)
    --translate         Dịch transcript sang tiếng Việt nếu không phải tiếng Việt
    --no-open           Không mở note trong Obsidian sau khi tạo
    --no-ai             Bỏ qua phân tích AI (chỉ lưu transcript)
    --provider PROVIDER AI provider: 'gemini' hoặc 'anthropic' (default: 'anthropic')
    --api-key KEY       API key cho provider đã chọn
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

# Gemini API imports
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

# Anthropic API imports
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

# OpenAI API imports
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def extract_video_id(url: str) -> str | None:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        # Standard watch URL
        r"(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})",
        # Short URL
        r"(?:youtu\.be\/)([a-zA-Z0-9_-]{11})",
        # Shorts URL
        r"(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})",
        # Embed URL
        r"(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})",
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    # Try parsing as query parameter
    parsed = urlparse(url)
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        qs = parse_qs(parsed.query)
        if "v" in qs:
            return qs["v"][0]

    return None


def get_video_metadata(video_id: str) -> dict:
    """Get video metadata using YouTube oEmbed API."""
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return {
            "title": data.get("title", "Untitled"),
            "author": data.get("author_name", "Unknown"),
            "thumbnail": data.get("thumbnail_url", ""),
        }
    except Exception as e:
        print(f"Warning: Could not fetch metadata: {e}", file=sys.stderr)
        return {"title": f"YouTube Video {video_id}", "author": "Unknown", "thumbnail": ""}


def get_transcript(video_id: str, translate_to_vi: bool = False) -> tuple[str, str, str]:
    """
    Get transcript for a YouTube video.
    Returns (formatted_text, original_language, raw_text)
    """
    try:
        # Create API instance and get transcript list
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.list(video_id)

        # Priority order for languages
        transcript = None
        original_lang = ""

        # Try to find Vietnamese first
        try:
            transcript = transcript_list.find_transcript(["vi"])
            original_lang = "vi"
        except NoTranscriptFound:
            pass

        # Try English if Vietnamese not found
        if transcript is None:
            try:
                transcript = transcript_list.find_transcript(["en"])
                original_lang = "en"
            except NoTranscriptFound:
                pass

        # Try any available transcript
        if transcript is None:
            try:
                # Get manually created transcripts first
                for t in transcript_list:
                    if not t.is_generated:
                        transcript = t
                        original_lang = t.language_code
                        break

                # Fall back to auto-generated
                if transcript is None:
                    for t in transcript_list:
                        transcript = t
                        original_lang = t.language_code
                        break
            except Exception:
                pass

        if transcript is None:
            raise NoTranscriptFound(video_id, [], None)

        # Translate if needed and requested
        if translate_to_vi and original_lang != "vi":
            try:
                transcript = transcript.translate("vi")
                print(f"Đã dịch từ {original_lang} sang tiếng Việt", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Không thể dịch transcript: {e}", file=sys.stderr)

        # Fetch and format transcript
        transcript_data = transcript.fetch()
        formatted_text = format_transcript(transcript_data)
        raw_text = format_transcript_raw(transcript_data)

        return formatted_text, original_lang, raw_text

    except TranscriptsDisabled:
        raise Exception("Transcript bị tắt cho video này")
    except VideoUnavailable:
        raise Exception("Video không khả dụng")
    except NoTranscriptFound:
        raise Exception("Không tìm thấy transcript cho video này")


def format_transcript(transcript_data) -> str:
    """Format transcript data into readable text with timestamps."""
    lines = []
    for entry in transcript_data:
        try:
            start_time = entry.start if hasattr(entry, 'start') else entry["start"]
            text = entry.text if hasattr(entry, 'text') else entry["text"]
        except (AttributeError, KeyError, TypeError):
            continue
            
        seconds = int(start_time)
        minutes = seconds // 60
        secs = seconds % 60
        timestamp = f"[{minutes:02d}:{secs:02d}]"

        text = text.strip() if text else ""
        if text:
            lines.append(f"{timestamp} {text}")

    return "\n".join(lines)


def format_transcript_raw(transcript_data) -> str:
    """Format transcript data into plain text without timestamps for AI analysis."""
    lines = []
    for entry in transcript_data:
        try:
            text = entry.text if hasattr(entry, 'text') else entry["text"]
        except (AttributeError, KeyError, TypeError):
            continue
        text = text.strip() if text else ""
        if text:
            lines.append(text)
    return " ".join(lines)


def sanitize_filename(title: str) -> str:
    """Sanitize title for use as filename."""
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, "", title)
    sanitized = re.sub(r"\s+", " ", sanitized)
    return sanitized.strip()[:100]


def get_obsidian_vault_path() -> str | None:
    """Get default Obsidian vault path using obsidian-cli."""
    try:
        result = subprocess.run(
            ["obsidian-cli", "print-default", "--path-only"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def get_ai_api_key(provider: str, provided_key: str | None = None) -> str | None:
    """Get API key for the chosen provider."""
    # 1. Provided directly
    if provided_key:
        return provided_key
    
    # 2. Environment variables
    if provider == "anthropic" and os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"]
    if provider == "gemini" and os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    if provider == "openai" and os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    
    # 3. Moltbot config
    moltbot_config = Path.home() / ".moltbot" / "moltbot.json"
    if moltbot_config.exists():
        try:
            config = json.loads(moltbot_config.read_text())
            # For anthropic, maybe check specific profile
            profile = config.get("auth", {}).get("profiles", {}).get("anthropic")
            if profile and provider == "anthropic":
                return profile.get("apiKey")
            
            # Legacy check for Gemini in nano-banana-pro
            if provider == "gemini":
                api_key = config.get("skills", {}).get("entries", {}).get("nano-banana-pro", {}).get("apiKey")
                if api_key:
                    return api_key
        except Exception:
            pass
    
    return None


def analyze_with_gemini(transcript: str, title: str, author: str, api_key: str) -> dict | None:
    """Analyze transcript with Gemini AI."""
    if not GEMINI_AVAILABLE:
        return None
    
    client = genai.Client(api_key=api_key)
    prompt = get_analysis_prompt(transcript, title, author)

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Warning: Gemini analysis failed: {e}", file=sys.stderr)
        return None


def analyze_with_anthropic(transcript: str, title: str, author: str, api_key: str) -> dict | None:
    """Analyze transcript with Anthropic Claude (Sonnet)."""
    if not ANTHROPIC_AVAILABLE:
        return None
    
    base_url = os.environ.get("ANTHROPIC_BASE_URL")
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    
    # Check for specific sonnet model in settings if present
    if "ANTHROPIC_DEFAULT_SONNET_MODEL" in os.environ:
        model = os.environ["ANTHROPIC_DEFAULT_SONNET_MODEL"]

    client = anthropic.Anthropic(api_key=api_key, base_url=base_url)
    prompt = get_analysis_prompt(transcript, title, author)

    try:
        response = client.messages.create(
            model=model,
            max_tokens=4000,
            temperature=0.7,
            system="Bạn là một chuyên gia về AI và tự động hóa. Chỉ trả về JSON.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        # Extract JSON from response
        text = response.content[0].text
        # Find JSON block if AI added extra text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(text)
    except Exception as e:
        print(f"Warning: Anthropic analysis failed: {e}", file=sys.stderr)
        return None


def analyze_with_openai(transcript: str, title: str, author: str, api_key: str) -> dict | None:
    """Analyze transcript with OpenAI GPT-4."""
    if not OPENAI_AVAILABLE:
        return None
    
    base_url = os.environ.get("OPENAI_BASE_URL")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    
    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    prompt = get_analysis_prompt(transcript, title, author)

    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=4000,
            temperature=0.7,
            messages=[
                {"role": "system", "content": "Bạn là một chuyên gia về AI và tự động hóa. Chỉ trả về JSON."},
                {"role": "user", "content": prompt}
            ]
        )
        
        # Extract JSON from response
        text = response.choices[0].message.content
        # Find JSON block if AI added extra text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(text)
    except Exception as e:
        print(f"Warning: OpenAI analysis failed: {e}", file=sys.stderr)
        return None


def get_analysis_prompt(transcript: str, title: str, author: str) -> str:
    """Get the common prompt for AI analysis."""
    return f"""Bạn là một chuyên gia về AI và tự động hóa. Hãy phân tích nội dung video sau và tạo ghi chú học tập chi tiết bằng tiếng Việt.

**Video**: {title}
**Channel**: {author}

**Transcript**:
{transcript[:30000]}  # Limit to avoid token limits

---

Hãy phân tích và trả về theo đúng format JSON sau:

{{
    "summary": "Tóm tắt ngắn gọn 2-3 câu về nội dung chính của video",
    "main_points": [
        "Điểm chính 1 - giải thích chi tiết",
        "Điểm chính 2 - giải thích chi tiết",
        "Điểm chính 3 - giải thích chi tiết"
    ],
    "concepts_explained": [
        {{
            "concept": "Tên khái niệm mới",
            "explanation": "Giải thích dễ hiểu cho người mới"
        }}
    ],
    "skills_to_learn": [
        "Kỹ năng 1 cần học thêm",
        "Kỹ năng 2 cần học thêm"
    ],
    "checklist": [
        "Điểm cần nhớ 1",
        "Điểm cần nhớ 2",
        "Điểm cần nhớ 3"
    ],
    "questions": [
        "Câu hỏi để suy ngẫm 1",
        "Câu hỏi để suy ngẫm 2"
    ],
    "related_topics": [
        "Chủ đề liên quan 1",
        "Chủ đề liên quan 2"
    ],
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}}

Lưu ý:
- Trả lời bằng tiếng Việt
- Giải thích các khái niệm mới một cách dễ hiểu
- Đề xuất các kỹ năng cần học để hiểu sâu hơn
- Tags nên bao gồm: chủ đề chính, công nghệ, kỹ năng liên quan
- Chỉ trả về JSON, không thêm text khác"""


def create_obsidian_note(
    title: str,
    content: str,
    folder: str,
    vault_path: str | None = None,
    open_note: bool = True,
) -> str:
    """Create note in Obsidian vault."""
    if vault_path is None:
        vault_path = get_obsidian_vault_path()

    if vault_path is None:
        raise Exception(
            "Không tìm thấy Obsidian vault. Hãy set default vault bằng: obsidian-cli set-default <vault-name>"
        )

    vault = Path(vault_path)
    if not vault.exists():
        raise Exception(f"Vault path không tồn tại: {vault_path}")

    note_folder = vault / folder
    note_folder.mkdir(parents=True, exist_ok=True)

    safe_title = sanitize_filename(title)
    note_path = note_folder / f"{safe_title}.md"

    counter = 1
    while note_path.exists():
        note_path = note_folder / f"{safe_title} ({counter}).md"
        counter += 1

    note_path.write_text(content, encoding="utf-8")

    if open_note:
        try:
            relative_path = note_path.relative_to(vault)
            subprocess.run(
                ["obsidian-cli", "open", str(relative_path)],
                capture_output=True,
                timeout=5,
            )
        except Exception:
            pass

    return str(note_path)


def create_note_content(
    title: str,
    author: str,
    url: str,
    original_lang: str,
    transcript: str,
    ai_analysis: dict | None = None,
) -> str:
    """Create markdown content for Obsidian note with AI analysis."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # Build tags string
    tags_list = ["youtube-note"]
    if ai_analysis and ai_analysis.get("tags"):
        tags_list.extend(ai_analysis["tags"])
    tags_str = "\n".join(f"  - {tag}" for tag in tags_list)
    
    content = f"""---
title: "{title}"
channel: "{author}"
youtube_url: "{url}"
created: "{now}"
type: youtube-note
tags:
{tags_str}
---

# {title}

## 📋 Thông tin
| | |
|---|---|
| **Channel** | {author} |
| **Link** | [YouTube]({url}) |
| **Ngôn ngữ gốc** | {original_lang} |
| **Thời gian tạo** | {now} |

"""

    # Add AI analysis sections if available
    if ai_analysis:
        # Summary
        if ai_analysis.get("summary"):
            content += f"""## 📝 Tóm tắt
{ai_analysis["summary"]}

"""
        
        # Main points
        if ai_analysis.get("main_points"):
            content += "## 📚 Nội dung chính\n"
            for i, point in enumerate(ai_analysis["main_points"], 1):
                content += f"{i}. {point}\n"
            content += "\n"
        
        # Concepts explained
        if ai_analysis.get("concepts_explained"):
            content += "## 💡 Khái niệm mới\n"
            for item in ai_analysis["concepts_explained"]:
                content += f"### {item.get('concept', 'Khái niệm')}\n"
                content += f"{item.get('explanation', '')}\n\n"
        
        # Skills to learn
        if ai_analysis.get("skills_to_learn"):
            content += "## 🎯 Kỹ năng cần học thêm\n"
            for skill in ai_analysis["skills_to_learn"]:
                content += f"- [ ] {skill}\n"
            content += "\n"
        
        # Checklist
        if ai_analysis.get("checklist"):
            content += "## ✅ Checklist - Điểm cần nhớ\n"
            for item in ai_analysis["checklist"]:
                content += f"- [ ] {item}\n"
            content += "\n"
        
        # Questions
        if ai_analysis.get("questions"):
            content += "## ❓ Câu hỏi để suy ngẫm\n"
            for q in ai_analysis["questions"]:
                content += f"- {q}\n"
            content += "\n"
        
        # Related topics (backlinks)
        if ai_analysis.get("related_topics"):
            content += "## 🔗 Chủ đề liên quan\n"
            for topic in ai_analysis["related_topics"]:
                # Create wiki-style links for Obsidian
                content += f"- [[{topic}]]\n"
            content += "\n"
    
    # Transcript section (collapsible)
    content += f"""## 📜 Transcript

<details>
<summary>Xem transcript đầy đủ</summary>

{transcript}

</details>

## 📚 Nguồn tham khảo
- [Video gốc]({url})
- Channel: {author}

## 🏷️ Ghi chú cá nhân

<!-- Thêm ghi chú của bạn ở đây -->

"""

    return content


def create_simple_note_content(
    title: str,
    author: str,
    url: str,
    original_lang: str,
    transcript: str,
) -> str:
    """Create simple markdown content without AI analysis."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    content = f"""---
title: "{title}"
channel: "{author}"
youtube_url: "{url}"
created: "{now}"
type: youtube-note
tags:
  - youtube-note
---

# {title}

## 📋 Thông tin
- **Channel**: {author}
- **Link**: [YouTube]({url})
- **Ngôn ngữ gốc**: {original_lang}
- **Thời gian tạo**: {now}

## 📝 Tóm tắt
<!-- Tóm tắt nội dung -->

## 📚 Nội dung chính
<!-- Chi tiết bài học -->

## ✅ Checklist
- [ ] Điểm cần nhớ 1
- [ ] Điểm cần nhớ 2

## 🔗 Liên kết
<!-- Backlinks đến notes khác -->

## ❓ Câu hỏi
<!-- Ghi lại thắc mắc -->

## 📜 Transcript

{transcript}

## 📚 Nguồn
- [Video gốc]({url})

## 🏷️ Ghi chú cá nhân

<!-- Thêm ghi chú của bạn ở đây -->

"""
    return content


def main():
    parser = argparse.ArgumentParser(
        description="Lấy transcript từ YouTube, phân tích với AI (Anthropic/Gemini) và lưu vào Obsidian"
    )
    parser.add_argument("--url", required=True, help="YouTube video URL")
    parser.add_argument(
        "--folder", default="YouTube Notes", help="Folder trong Obsidian vault"
    )
    parser.add_argument("--vault", help="Đường dẫn tới Obsidian vault")
    parser.add_argument(
        "--translate", action="store_true", help="Dịch sang tiếng Việt"
    )
    parser.add_argument(
        "--no-open", action="store_true", help="Không mở note sau khi tạo"
    )
    parser.add_argument(
        "--no-ai", action="store_true", help="Bỏ qua phân tích AI"
    )
    parser.add_argument(
        "--provider", default="openai", choices=["anthropic", "openai"], help="AI provider"
    )
    parser.add_argument(
        "--api-key", help="API key cho provider"
    )
    parser.add_argument(
        "--repurpose", action="store_true",
        help="Tạo content đa platform (5 formats: Social, Thread, Email, Summary, Hooks)"
    )
    parser.add_argument(
        "--platforms", nargs="+", default=["all"],
        choices=["all", "social", "thread", "email", "summary", "hooks"],
        help="Chọn platforms cần repurpose (default: all)"
    )

    args = parser.parse_args()

    # Extract video ID
    video_id = extract_video_id(args.url)
    if not video_id:
        print(f"Error: Không thể trích xuất video ID từ URL: {args.url}", file=sys.stderr)
        sys.exit(1)

    print(f"Video ID: {video_id}", file=sys.stderr)

    # Get metadata
    print("Đang lấy thông tin video...", file=sys.stderr)
    metadata = get_video_metadata(video_id)
    print(f"Tiêu đề: {metadata['title']}", file=sys.stderr)
    print(f"Channel: {metadata['author']}", file=sys.stderr)

    # Get transcript
    print("Đang lấy transcript...", file=sys.stderr)
    try:
        transcript, original_lang, raw_transcript = get_transcript(video_id, translate_to_vi=args.translate)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Ngôn ngữ gốc: {original_lang}", file=sys.stderr)

    # AI Analysis
    ai_analysis = None
    if not args.no_ai:
        api_key = get_ai_api_key(args.provider, args.api_key)
        if api_key:
            print(f"Đang phân tích với AI ({args.provider})...", file=sys.stderr)
            if args.provider == "anthropic":
                ai_analysis = analyze_with_anthropic(
                    raw_transcript, metadata["title"], metadata["author"], api_key
                )
            elif args.provider == "openai":
                ai_analysis = analyze_with_openai(
                    raw_transcript, metadata["title"], metadata["author"], api_key
                )
            else:
                ai_analysis = analyze_with_gemini(
                    raw_transcript, metadata["title"], metadata["author"], api_key
                )
            
            if ai_analysis:
                print(f"✓ AI analysis ({args.provider}) hoàn thành", file=sys.stderr)
        else:
            print(f"Warning: Không có API key cho {args.provider}, bỏ qua AI analysis", file=sys.stderr)

    # Create note content
    if ai_analysis:
        content = create_note_content(
            title=metadata["title"],
            author=metadata["author"],
            url=args.url,
            original_lang=original_lang,
            transcript=transcript,
            ai_analysis=ai_analysis,
        )
    else:
        content = create_simple_note_content(
            title=metadata["title"],
            author=metadata["author"],
            url=args.url,
            original_lang=original_lang,
            transcript=transcript,
        )

    # Save to Obsidian
    print("Đang lưu vào Obsidian...", file=sys.stderr)
    try:
        note_path = create_obsidian_note(
            title=metadata["title"],
            content=content,
            folder=args.folder,
            vault_path=args.vault,
            open_note=not args.no_open,
        )
        print(f"✓ Đã tạo note: {note_path}", file=sys.stderr)
        print(f"NOTE_PATH:{note_path}")
        
        # Content Repurposing
        if args.repurpose and ai_analysis:
            print("Đang tạo content đa platform...", file=sys.stderr)
            try:
                from content_repurposer import (
                    create_repurposed_content,
                    format_repurposed_markdown,
                )
                
                api_key = get_ai_api_key(args.provider, args.api_key)
                if api_key:
                    repurposed = create_repurposed_content(
                        title=metadata["title"],
                        author=metadata["author"],
                        url=args.url,
                        ai_analysis=ai_analysis,
                        provider=args.provider,
                        api_key=api_key,
                    )
                    
                    if repurposed:
                        repurposed_content = format_repurposed_markdown(
                            repurposed=repurposed,
                            title=metadata["title"],
                            author=metadata["author"],
                            url=args.url,
                        )
                        
                        # Save repurposed content
                        repurposed_path = Path(note_path).parent / f"{sanitize_filename(metadata['title'])}_repurposed.md"
                        repurposed_path.write_text(repurposed_content, encoding="utf-8")
                        
                        print(f"✓ Đã tạo repurposed content: {repurposed_path}", file=sys.stderr)
                        print(f"REPURPOSED_PATH:{repurposed_path}")
                    else:
                        print("Warning: Không thể tạo repurposed content", file=sys.stderr)
                else:
                    print("Warning: Cần API key để repurpose content", file=sys.stderr)
            except ImportError as e:
                print(f"Warning: Không thể import content_repurposer: {e}", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Repurposing failed: {e}", file=sys.stderr)
        elif args.repurpose and not ai_analysis:
            print("Warning: Cần AI analysis để repurpose. Bỏ --no-ai để sử dụng.", file=sys.stderr)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
