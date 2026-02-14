"""
Module để lấy transcript từ video YouTube.
"""

from youtube_transcript_api import YouTubeTranscriptApi
import re
from typing import Optional


def fetch(video_url: str) -> Optional[str]:
    """
    Lấy transcript từ video YouTube.

    Args:
        video_url: URL của video YouTube (hỗ trợ các định dạng youtube.com/watch?v=, youtu.be/, v.v.)

    Returns:
        Nội dung transcript dưới dạng chuỗi văn bản nếu thành công, None nếu có lỗi
    """
    try:
        # Trích xuất video ID từ URL
        video_id = _extract_video_id(video_url)
        if not video_id:
            return None

        # Thử lấy transcript với thứ tự ưu tiên ngôn ngữ: vi -> en
        transcript_data = None

        try:
            # Lấy danh sách các transcript có sẵn
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # Ưu tiên tiếng Việt
            try:
                transcript = transcript_list.find_transcript(['vi'])
                transcript_data = transcript.fetch()
            except:
                # Nếu không có tiếng Việt, thử tiếng Anh
                try:
                    transcript = transcript_list.find_transcript(['en'])
                    transcript_data = transcript.fetch()
                except:
                    # Nếu không có cả vi và en, lấy bất kỳ transcript nào có sẵn
                    transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
        except:
            # Fallback: thử lấy transcript mặc định
            transcript_data = YouTubeTranscriptApi.get_transcript(video_id)

        if not transcript_data:
            return None

        # Ghép tất cả các đoạn text thành một chuỗi duy nhất
        full_text = ' '.join([entry['text'] for entry in transcript_data])
        return full_text

    except Exception:
        # Xử lý mọi lỗi một cách an toàn
        return None


def _extract_video_id(url: str) -> Optional[str]:
    """
    Trích xuất video ID từ URL YouTube.

    Args:
        url: URL của video YouTube

    Returns:
        Video ID nếu tìm thấy, None nếu không hợp lệ
    """
    # Các pattern để match các định dạng URL YouTube khác nhau
    patterns = [
        r'(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None
