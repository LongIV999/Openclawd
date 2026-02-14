"""
Module để phân tích và tóm tắt transcript từ video YouTube.
"""

import os
import json
import requests
from typing import Optional


# Đọc cấu hình từ biến môi trường
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_API_ENDPOINT_URL = os.getenv("LLM_API_ENDPOINT_URL")


def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> list[str]:
    """
    Chia văn bản thành các đoạn nhỏ với overlap để giữ ngữ cảnh.

    Args:
        text: Văn bản cần chia
        chunk_size: Kích thước mỗi đoạn (tính theo số từ)
        overlap: Số từ chồng lấn giữa các đoạn

    Returns:
        Danh sách các đoạn văn bản
    """
    words = text.split()
    chunks = []

    i = 0
    while i < len(words):
        # Lấy chunk hiện tại
        chunk_words = words[i:i + chunk_size]
        chunks.append(' '.join(chunk_words))

        # Di chuyển con trỏ, trừ đi overlap để tạo sự chồng lấn
        i += chunk_size - overlap

        # Nếu đã đến cuối, dừng lại
        if i + overlap >= len(words):
            break

    return chunks


def summarize_chunk(chunk: str) -> str:
    """
    Tóm tắt một đoạn văn bản bằng cách gọi API của LLM.

    Args:
        chunk: Đoạn văn bản cần tóm tắt

    Returns:
        Bản tóm tắt của đoạn văn bản
    """
    if not LLM_API_KEY or not LLM_API_ENDPOINT_URL:
        raise ValueError("LLM_API_KEY hoặc LLM_API_ENDPOINT_URL chưa được cấu hình")

    prompt = f"Hãy tóm tắt đoạn văn bản sau một cách ngắn gọn và súc tích: {chunk}"

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "gpt-4",  # Có thể thay đổi model tùy theo endpoint
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }

    try:
        response = requests.post(LLM_API_ENDPOINT_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()

        result = response.json()
        summary = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return summary.strip()

    except Exception as e:
        print(f"Lỗi khi tóm tắt chunk: {e}")
        return chunk[:500]  # Fallback: trả về 500 ký tự đầu


def analyze_transcript(full_transcript: str, longbestai_brand_guide: str = "") -> dict:
    """
    Phân tích toàn bộ transcript và trả về các thông tin có cấu trúc.

    Args:
        full_transcript: Bản transcript đầy đủ của video
        longbestai_brand_guide: Brand guide của Long Best AI (không sử dụng trong version này)

    Returns:
        Dictionary chứa các thông tin phân tích
    """
    if not LLM_API_KEY or not LLM_API_ENDPOINT_URL:
        raise ValueError("LLM_API_KEY hoặc LLM_API_ENDPOINT_URL chưa được cấu hình")

    # Bước 1: Chia transcript thành các chunks
    chunks = chunk_text(full_transcript)

    # Bước 2: Tóm tắt từng chunk
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        print(f"Đang tóm tắt chunk {i+1}/{len(chunks)}...")
        summary = summarize_chunk(chunk)
        chunk_summaries.append(summary)

    # Bước 3: Ghép các tóm tắt nhỏ thành super_summary
    super_summary = "\n\n".join(chunk_summaries)

    # Bước 4: Phân tích cuối cùng với prompt chi tiết
    analysis_prompt = f"""
Bạn là một chuyên gia phân tích nội dung và là một content creator với thương hiệu "Long Best AI".
Dựa vào bản tóm tắt của video dưới đây, hãy phân tích và trả về một đối tượng JSON với các key sau:
- "title": Một tiêu đề hấp dẫn, tóm gọn nội dung chính của video.
- "overall_summary": Một đoạn văn tóm tắt tổng thể nội dung video trong khoảng 150 từ.
- "key_takeaways": Một danh sách (list) gồm 3-5 điểm chính quan trọng nhất, mỗi điểm là một chuỗi văn bản.
- "action_items": Một danh sách các bước hành động hoặc hướng dẫn cụ thể được đề cập trong video. Nếu không có, trả về danh sách rỗng.
- "mentioned_entities": Một danh sách các thuật ngữ, tên công cụ, hoặc tên người quan trọng được nhắc đến.
- "discussion_questions": Một danh sách gồm 2 câu hỏi mở để thảo luận, giúp khơi gợi sự tương tác trong một group công nghệ.

Đây là bản tóm tắt video: {super_summary}

Chỉ trả về JSON object, không có text thêm.
"""

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "gpt-4",
        "messages": [
            {"role": "user", "content": analysis_prompt}
        ],
        "temperature": 0.7
    }

    try:
        print("Đang phân tích tổng thể...")
        response = requests.post(LLM_API_ENDPOINT_URL, headers=headers, json=payload, timeout=120)
        response.raise_for_status()

        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Parse JSON từ response
        # Loại bỏ markdown code blocks nếu có
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        analysis_result = json.loads(content)
        return analysis_result

    except Exception as e:
        print(f"Lỗi khi phân tích transcript: {e}")
        # Trả về cấu trúc mặc định nếu có lỗi
        return {
            "title": "Không thể phân tích",
            "overall_summary": super_summary[:500],
            "key_takeaways": [],
            "action_items": [],
            "mentioned_entities": [],
            "discussion_questions": []
        }
