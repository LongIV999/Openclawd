"""
File điều phối chính cho skill summarize_youtube.
"""

import sys
import os
from pathlib import Path

# Import các module từ cùng thư mục
import transcript_fetcher
import summarizer
import note_formatter


def main():
    """Hàm chính để xử lý tóm tắt video YouTube."""

    # Bước 1: Đọc URL từ tham số dòng lệnh
    if len(sys.argv) < 2:
        print("❌ Lỗi: Vui lòng cung cấp URL video YouTube.", file=sys.stderr)
        print("Cách sử dụng: python main.py <youtube_url>", file=sys.stderr)
        sys.exit(1)

    youtube_url = sys.argv[1]

    # Bước 2: Lấy transcript từ video
    print("🔍 Đang lấy transcript từ video...", file=sys.stderr)
    transcript = transcript_fetcher.fetch(youtube_url)

    if transcript is None:
        print("❌ Lỗi: Không thể lấy transcript từ video. Video có thể bị khóa hoặc không có phụ đề.", file=sys.stderr)
        sys.exit(1)

    print(f"✅ Đã lấy transcript thành công ({len(transcript)} ký tự)", file=sys.stderr)

    # Bước 3: Đọc brand guide từ thư mục gốc của dự án
    project_root = Path(__file__).parent.parent.parent  # Lên 3 cấp từ skills/summarize_youtube/main.py
    brand_guide_path = project_root / "longbestai_brand_guide.md"

    brand_guide_content = ""
    if brand_guide_path.exists():
        print(f"📖 Đang đọc brand guide từ {brand_guide_path}...", file=sys.stderr)
        with open(brand_guide_path, 'r', encoding='utf-8') as f:
            brand_guide_content = f.read()
        print("✅ Đã đọc brand guide thành công", file=sys.stderr)
    else:
        print(f"⚠️  Cảnh báo: Không tìm thấy file brand guide tại {brand_guide_path}", file=sys.stderr)

    # Bước 4: Phân tích transcript
    print("🧠 Đang phân tích transcript...", file=sys.stderr)
    try:
        analysis_data = summarizer.analyze_transcript(transcript, brand_guide_content)
        print("✅ Đã phân tích xong", file=sys.stderr)
    except Exception as e:
        print(f"❌ Lỗi khi phân tích transcript: {e}", file=sys.stderr)
        sys.exit(1)

    # Bước 5: Định dạng thành markdown
    print("📝 Đang tạo ghi chú markdown...", file=sys.stderr)
    markdown_output = note_formatter.format_as_markdown(analysis_data, youtube_url)
    print("✅ Hoàn tất!", file=sys.stderr)

    # Bước 6: In kết quả ra standard output
    # QUAN TRỌNG: In ra stdout để OpenClaw có thể nhận kết quả
    print(markdown_output)


if __name__ == "__main__":
    main()
