import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

def get_obsidian_vault_path():
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

def create_obsidian_note(title, content, folder="YouTube Notes"):
    vault_path = get_obsidian_vault_path()
    if not vault_path:
        print("Error: No Obsidian vault found.")
        sys.exit(1)
    
    vault = Path(vault_path)
    note_folder = vault / folder
    note_folder.mkdir(parents=True, exist_ok=True)
    
    safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()[:100]
    note_path = note_folder / f"{safe_title}.md"
    
    with open(note_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"Note created: {note_path}")
    
    # Open the note
    try:
        relative_path = note_path.relative_to(vault)
        subprocess.run(["obsidian-cli", "open", str(relative_path)])
    except:
        pass

if __name__ == "__main__":
    title = sys.argv[1]
    with open(sys.argv[2], "r") as f:
        content_txt = f.read()
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    url = "https://www.youtube.com/watch?v=U8kXfk8enrY"
    
    note_content = f"""---
title: "{title}"
youtube_url: "{url}"
created: "{now}"
type: youtube-note
tags:
  - youtube-note
  - transcript
---

# {title}

## 📋 Thông tin
- **Link**: [YouTube]({url})
- **Thời gian tạo**: {now}

## 📜 Transcript (Auto-downloaded)

{content_txt}
"""
    create_obsidian_note(title, note_content)
