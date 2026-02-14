"""
Module để định dạng kết quả phân tích thành markdown cho Obsidian.
"""

from datetime import datetime
from typing import Dict, List


def format_as_markdown(analysis_data: dict, youtube_url: str) -> str:
    """
    Định dạng dữ liệu phân tích thành markdown cho Obsidian.

    Args:
        analysis_data: Dictionary chứa kết quả phân tích từ summarizer
        youtube_url: URL gốc của video YouTube

    Returns:
        Chuỗi markdown được định dạng đẹp cho Obsidian
    """
    # Lấy ngày giờ hiện tại
    created_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Xây dựng YAML frontmatter
    frontmatter = f"""---
tags: [youtube, summary]
source: {youtube_url}
created: {created_date}
---

"""

    # Lấy dữ liệu từ analysis_data, với giá trị mặc định nếu không tồn tại
    title = analysis_data.get("title", "YouTube Video Summary")
    overall_summary = analysis_data.get("overall_summary", "Không có tóm tắt.")
    key_takeaways = analysis_data.get("key_takeaways", [])
    action_items = analysis_data.get("action_items", [])
    mentioned_entities = analysis_data.get("mentioned_entities", [])
    discussion_questions = analysis_data.get("discussion_questions", [])
    content_ideas = analysis_data.get("longbestai_content_ideas", [])

    # Xây dựng nội dung chính
    markdown_content = f"# {title}\n\n"

    # Link đến video gốc
    markdown_content += f"🎥 **Video:** {youtube_url}\n\n"

    # Phần tóm tắt tổng thể
    markdown_content += "## 📝 Tóm Tắt Tổng Thể\n\n"
    markdown_content += f"{overall_summary}\n\n"

    # Key Takeaways
    markdown_content += "## 🎯 Key Takeaways\n\n"
    if key_takeaways:
        for takeaway in key_takeaways:
            markdown_content += f"- {takeaway}\n"
    else:
        markdown_content += "_Không có điểm chính nào được ghi nhận._\n"
    markdown_content += "\n"

    # Action Items
    markdown_content += "## ✅ Action Items\n\n"
    if action_items:
        for item in action_items:
            markdown_content += f"- [ ] {item}\n"
    else:
        markdown_content += "_Không có hành động cụ thể nào được đề cập._\n"
    markdown_content += "\n"

    # Mentioned Entities
    markdown_content += "## 🏷️ Mentioned Entities\n\n"
    if mentioned_entities:
        # Định dạng entities thành tags Obsidian
        entity_tags = " • ".join([f"**{entity}**" for entity in mentioned_entities])
        markdown_content += f"{entity_tags}\n"
    else:
        markdown_content += "_Không có thuật ngữ hoặc thực thể nào được ghi nhận._\n"
    markdown_content += "\n"

    # Discussion Questions
    markdown_content += "## 💭 Discussion Questions\n\n"
    if discussion_questions:
        for i, question in enumerate(discussion_questions, 1):
            markdown_content += f"{i}. {question}\n"
    else:
        markdown_content += "_Không có câu hỏi thảo luận nào._\n"
    markdown_content += "\n"

    # Content Ideas for Long Best AI
    if content_ideas:
        markdown_content += "## 🚀 Content Ideas for Long Best AI\n\n"
        if isinstance(content_ideas, list):
            for i, idea in enumerate(content_ideas, 1):
                markdown_content += f"### Ý tưởng {i}\n\n"
                markdown_content += f"{idea}\n\n"
        else:
            markdown_content += f"{content_ideas}\n\n"

    # Footer với separator
    markdown_content += "---\n\n"
    markdown_content += f"_Note created on {created_date}_\n"

    # Ghép frontmatter và nội dung
    final_markdown = frontmatter + markdown_content

    return final_markdown
