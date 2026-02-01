import re
import sys

def clean_vtt(vtt_content):
    # Remove header
    content = re.sub(r'WEBVTT\nKind: captions\nLanguage: .*\n', '', vtt_content)
    
    # Remove timestamps and settings
    content = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n', '', content)
    
    # Remove <...><c> tags
    content = re.sub(r'<\d{2}:\d{2}:\d{2}\.\d{3}>', '', content)
    content = re.sub(r'</?c>', '', content)
    
    # Remove duplicate lines (yt-dlp auto-subs often repeat lines for each word highlight)
    lines = content.split('\n')
    unique_lines = []
    last_line = ""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # If it's the same as the last line, skip
        if line == last_line:
            continue
        # If the last line is a prefix of this line, it's likely a buildup, replace it
        if last_line and line.startswith(last_line):
            unique_lines[-1] = line
            last_line = line
            continue
            
        unique_lines.append(line)
        last_line = line
    
    return " ".join(unique_lines)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python vtt_to_text.py input.vtt")
        sys.exit(1)
    
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        print(clean_vtt(f.read()))
