#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "anthropic>=0.42.0",
#     "google-genai>=1.0.0",
#     "openai>=1.0.0",
# ]
# ///
"""
Content Repurposer - Chuyển đổi nội dung thành nhiều formats đa platform.

Tạo 5 formats khác nhau từ content gốc:
1. Social Post (Facebook/LinkedIn) - 100-200 từ
2. Thread/Carousel (Twitter/Instagram) - 5-7 slides
3. Email Newsletter - 300-500 từ
4. Summary/TL;DR - 50-100 từ
5. Hook Collection - 5 hooks khác nhau
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

# Anthropic API imports
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

# Gemini API imports
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

# OpenAI API imports
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def get_repurpose_prompt(
    summary: str,
    main_points: list,
    title: str,
    author: str,
    url: str,
) -> str:
    """Generate prompt for content repurposing."""
    points_text = "\n".join(f"- {p}" for p in main_points)

    return f"""Bạn là một content strategist chuyên nghiệp. Hãy chuyển đổi nội dung video sau thành 5 formats khác nhau để phân phối đa kênh.

**Video**: {title}
**Channel**: {author}
**URL**: {url}

**Tóm tắt**: {summary}

**Điểm chính**:
{points_text}

---

Hãy tạo content theo đúng format JSON sau:

{{
    "social_post": {{
        "content": "Nội dung post 100-200 từ với Hook → Value → CTA",
        "platform": "Facebook/LinkedIn",
        "character_count": 0
    }},
    "thread": {{
        "slides": [
            {{"slide": 1, "type": "hook", "content": "Hook slide - câu mở đầu thu hút"}},
            {{"slide": 2, "type": "content", "content": "Điểm chính 1"}},
            {{"slide": 3, "type": "content", "content": "Điểm chính 2"}},
            {{"slide": 4, "type": "content", "content": "Điểm chính 3"}},
            {{"slide": 5, "type": "cta", "content": "CTA slide - kêu gọi hành động"}}
        ],
        "platform": "Twitter/Instagram"
    }},
    "email": {{
        "subject": "Subject line hấp dẫn",
        "preview": "Preview text 50-80 ký tự",
        "body": "Nội dung email 300-500 từ, tone personal và conversational"
    }},
    "summary": {{
        "content": "TL;DR 50-100 từ, bullet points hoặc 1 paragraph"
    }},
    "hooks": [
        {{"type": "curiosity", "hook": "Hook gây tò mò"}},
        {{"type": "pain_point", "hook": "Hook đánh vào pain point"}},
        {{"type": "benefit", "hook": "Hook nêu lợi ích"}},
        {{"type": "contrarian", "hook": "Hook quan điểm ngược"}},
        {{"type": "story", "hook": "Hook bắt đầu bằng câu chuyện"}}
    ]
}}

Lưu ý:
- Viết bằng tiếng Việt
- Social post phải có cấu trúc Hook → Value → CTA rõ ràng
- Thread phải có 5-7 slides, slide đầu là hook, slide cuối là CTA
- Email phải có Subject hấp dẫn và tone personal
- Hooks phải đa dạng góc độ
- Character count cho social post là số ký tự thực tế
- Chỉ trả về JSON, không thêm text khác"""


def repurpose_with_anthropic(
    summary: str,
    main_points: list,
    title: str,
    author: str,
    url: str,
    api_key: str,
) -> dict | None:
    """Repurpose content using Anthropic Claude."""
    if not ANTHROPIC_AVAILABLE:
        return None

    base_url = os.environ.get("ANTHROPIC_BASE_URL")
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    
    if "ANTHROPIC_DEFAULT_SONNET_MODEL" in os.environ:
        model = os.environ["ANTHROPIC_DEFAULT_SONNET_MODEL"]

    client = anthropic.Anthropic(api_key=api_key, base_url=base_url)
    prompt = get_repurpose_prompt(summary, main_points, title, author, url)

    try:
        response = client.messages.create(
            model=model,
            max_tokens=4000,
            temperature=0.8,
            system="Bạn là content strategist chuyên nghiệp. Chỉ trả về JSON.",
            messages=[{"role": "user", "content": prompt}]
        )
        
        text = response.content[0].text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(text)
    except Exception as e:
        print(f"Warning: Anthropic repurposing failed: {e}")
        return None


def repurpose_with_openai(
    summary: str,
    main_points: list,
    title: str,
    author: str,
    url: str,
    api_key: str,
) -> dict | None:
    """Repurpose content using OpenAI GPT-4."""
    if not OPENAI_AVAILABLE:
        return None

    base_url = os.environ.get("OPENAI_BASE_URL")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")

    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    prompt = get_repurpose_prompt(summary, main_points, title, author, url)

    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=4000,
            temperature=0.8,
            messages=[
                {"role": "system", "content": "Bạn là content strategist chuyên nghiệp. Chỉ trả về JSON."},
                {"role": "user", "content": prompt}
            ]
        )
        
        text = response.choices[0].message.content
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(text)
    except Exception as e:
        print(f"Warning: OpenAI repurposing failed: {e}")
        return None


def repurpose_with_gemini(
    summary: str,
    main_points: list,
    title: str,
    author: str,
    url: str,
    api_key: str,
) -> dict | None:
    """Repurpose content using Gemini."""
    if not GEMINI_AVAILABLE:
        return None

    client = genai.Client(api_key=api_key)
    prompt = get_repurpose_prompt(summary, main_points, title, author, url)

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.8,
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Warning: Gemini repurposing failed: {e}")
        return None


def create_repurposed_content(
    title: str,
    author: str,
    url: str,
    ai_analysis: dict,
    provider: str = "anthropic",
    api_key: str | None = None,
) -> dict | None:
    """Main function to repurpose content into 5 formats."""
    summary = ai_analysis.get("summary", "")
    main_points = ai_analysis.get("main_points", [])

    if not summary or not main_points:
        print("Warning: Không đủ dữ liệu để repurpose (cần summary và main_points)")
        return None

    if provider == "anthropic" and api_key:
        return repurpose_with_anthropic(summary, main_points, title, author, url, api_key)
    elif provider == "openai" and api_key:
        return repurpose_with_openai(summary, main_points, title, author, url, api_key)
    elif provider == "gemini" and api_key:
        return repurpose_with_gemini(summary, main_points, title, author, url, api_key)
    
    return None


def format_repurposed_markdown(
    repurposed: dict,
    title: str,
    author: str,
    url: str,
) -> str:
    """Format repurposed content as markdown."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    content = f"""---
title: "{title} - Repurposed Content"
original_video: "{url}"
channel: "{author}"
created: "{now}"
type: repurposed-content
---

# 🔄 Repurposed Content

**Video gốc:** [{title}]({url})  
**Channel:** {author}

---

## 1. 📱 Social Post

"""
    
    # Social Post
    if repurposed.get("social_post"):
        sp = repurposed["social_post"]
        content += f"""{sp.get("content", "")}

**Platform:** {sp.get("platform", "Facebook/LinkedIn")}  
**Character count:** {sp.get("character_count", len(sp.get("content", "")))}

---

"""

    # Thread/Carousel
    content += "## 2. 🧵 Thread/Carousel\n\n"
    if repurposed.get("thread"):
        thread = repurposed["thread"]
        for slide in thread.get("slides", []):
            slide_num = slide.get("slide", 1)
            slide_type = slide.get("type", "content").upper()
            slide_content = slide.get("content", "")
            content += f"""**{slide_num}/{len(thread.get("slides", []))} - {slide_type}:**
{slide_content}

"""
        content += f"""**Platform:** {thread.get("platform", "Twitter/Instagram")}

---

"""

    # Email Newsletter
    content += "## 3. 📧 Email Newsletter\n\n"
    if repurposed.get("email"):
        email = repurposed["email"]
        content += f"""**Subject:** {email.get("subject", "")}  
**Preview:** {email.get("preview", "")}

{email.get("body", "")}

---

"""

    # Summary/TL;DR
    content += "## 4. 📝 Summary/TL;DR\n\n"
    if repurposed.get("summary"):
        content += f"""{repurposed["summary"].get("content", "")}

---

"""

    # Hook Collection
    content += """## 5. 🎣 Hook Collection

| # | Type | Hook |
|---|------|------|
"""
    if repurposed.get("hooks"):
        for i, hook in enumerate(repurposed["hooks"], 1):
            hook_type = hook.get("type", "").replace("_", " ").title()
            hook_text = hook.get("hook", "").replace("|", "\\|")
            content += f"| {i} | {hook_type} | {hook_text} |\n"
    
    content += f"""

---

## 📋 Sử dụng nhanh

- **Copy social post** → Paste vào Facebook/LinkedIn
- **Thread** → Tạo carousel trên Canva hoặc post từng tweet
- **Email** → Gửi newsletter
- **Hooks** → Dùng cho video script, ad copy, headlines

---

*Generated from: [{url}]({url})*
"""

    return content


def save_repurposed_content(
    content: str,
    base_path: Path,
    title: str,
) -> Path:
    """Save repurposed content to file."""
    from youtube_to_obsidian import sanitize_filename
    
    safe_title = sanitize_filename(title)
    output_path = base_path.parent / f"{safe_title}_repurposed.md"
    
    counter = 1
    while output_path.exists():
        output_path = base_path.parent / f"{safe_title}_repurposed ({counter}).md"
        counter += 1
    
    output_path.write_text(content, encoding="utf-8")
    return output_path
