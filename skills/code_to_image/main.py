#!/Users/admin/clawbot/skills/code_to_image/venv/bin/python3
"""
Skill code_to_image: Tạo ảnh đẹp từ code snippet sử dụng Ray.so
"""

import sys
import os
import json
import argparse
from urllib.parse import quote
from pathlib import Path
from playwright.async_api import async_playwright
import asyncio


def load_config():
    """Load configuration từ config.json"""
    config_path = Path(__file__).parent / "config.json"

    # Default config nếu file không tồn tại
    default_config = {
        "theme": "breeze",
        "padding": "32",
        "background": "true",
        "darkMode": "true",
        "title": "My Code Snippet"
    }

    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    return default_config


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Tạo ảnh đẹp từ code snippet sử dụng Ray.so"
    )

    parser.add_argument(
        "--code",
        required=True,
        help="Đoạn code cần tạo ảnh"
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Đường dẫn file PNG output"
    )

    parser.add_argument(
        "--title",
        help="Tiêu đề hiển thị trên ảnh"
    )

    parser.add_argument(
        "--theme",
        help="Theme màu (ví dụ: breeze, dracula, candy, etc.)"
    )

    parser.add_argument(
        "--padding",
        help="Padding của ảnh (16, 32, 64, 128)"
    )

    parser.add_argument(
        "--language",
        help="Ngôn ngữ lập trình (auto-detect nếu không chỉ định)"
    )

    parser.add_argument(
        "--custom-theme",
        help="Custom theme (tech_noir, brutalist, clean_future)"
    )

    return parser.parse_args()


async def create_code_image(code, output_path, config):
    """
    Tạo ảnh từ code snippet bằng Ray.so

    Args:
        code: Đoạn code cần tạo ảnh
        output_path: Đường dẫn lưu file PNG
        config: Dictionary chứa cấu hình (theme, padding, etc.)
    """

    # Build URL với encoded parameters
    params = {
        'code': quote(code),
        'title': quote(config.get('title', '')),
        'theme': config.get('theme', 'breeze'),
        'padding': config.get('padding', '32'),
        'background': config.get('background', 'true'),
        'darkMode': config.get('darkMode', 'true')
    }

    if 'language' in config and config['language']:
        params['language'] = config['language']

    # Construct URL
    url = f"https://ray.so/#code={params['code']}&title={params['title']}&theme={params['theme']}&padding={params['padding']}&background={params['background']}&darkMode={params['darkMode']}"

    if 'language' in params:
        url += f"&language={params['language']}"

    print(f"🔍 Đang truy cập Ray.so...", file=sys.stderr)

    # Launch Playwright
    async with async_playwright() as p:
        # Launch webkit (lightweight browser)
        browser = await p.webkit.launch(headless=True)
        page = await browser.new_page()

        try:
            # Navigate to Ray.so
            print(f"🌐 Đang load trang với URL đã encode...", file=sys.stderr)
            await page.goto(url, wait_until='networkidle', timeout=30000)

            # Wait for frame to be ready before injecting
            await page.wait_for_selector('#frame', state='attached', timeout=15000)

            # Inject custom theme if provided
            custom_theme_name = config.get('custom_theme')
            if custom_theme_name:
                theme_path = Path(__file__).parent / "themes" / f"{custom_theme_name}.css"
                if theme_path.exists():
                    print(f"🎨 Đang inject custom theme: {custom_theme_name}...", file=sys.stderr)
                    with open(theme_path, 'r', encoding='utf-8') as f:
                        css_content = f.read()
                    
                    # Inject CSS
                    await page.add_style_tag(content=css_content)
                    
                    # Inject Watermark Element
                    js_inject = ""
                    if custom_theme_name == 'tech_noir':
                        js_inject = """
                        const frame = document.querySelector('#frame');
                        frame.style.position = 'relative'; // Ensure positioning context
                        const wm = document.createElement('div');
                        wm.innerText = 'LongBest AI';
                        wm.style.position = 'absolute';
                        wm.style.bottom = '32px'; /* Matches padding usually */
                        wm.style.right = '32px';
                        wm.style.fontFamily = '"JetBrains Mono", monospace';
                        wm.style.fontSize = '16px';
                        wm.style.fontWeight = 'bold';
                        wm.style.color = 'rgba(0, 255, 255, 0.6)';
                        wm.style.textShadow = '0 0 8px rgba(0, 255, 255, 0.4)';
                        wm.style.zIndex = '9999';
                        wm.style.pointerEvents = 'none';
                        frame.appendChild(wm);
                        """
                    elif custom_theme_name == 'brutalist':
                        js_inject = """
                        const frame = document.querySelector('#frame');
                        frame.style.position = 'relative';
                        const wm = document.createElement('div');
                        wm.innerText = 'LONGBEST AI';
                        wm.style.position = 'absolute';
                        wm.style.top = '20px';
                        wm.style.left = '20px';
                        wm.style.fontFamily = '"Courier New", monospace';
                        wm.style.fontSize = '32px';
                        wm.style.fontWeight = '900';
                        wm.style.color = '#000';
                        wm.style.backgroundColor = '#fff';
                        wm.style.padding = '4px 12px';
                        wm.style.border = '2px solid #000';
                        wm.style.transform = 'rotate(-2deg)';
                        wm.style.zIndex = '9999';
                        frame.appendChild(wm);
                        """
                    elif custom_theme_name == 'clean_future':
                        js_inject = """
                        const frame = document.querySelector('#frame');
                        frame.style.position = 'relative';
                        const wm = document.createElement('div');
                        wm.innerText = 'Designed by LongBest AI';
                        wm.style.position = 'absolute';
                        wm.style.bottom = '20px';
                        wm.style.left = '50%';
                        wm.style.transform = 'translateX(-50%)';
                        wm.style.fontFamily = 'system-ui, sans-serif';
                        wm.style.fontSize = '14px';
                        wm.style.color = '#888';
                        wm.style.zIndex = '9999';
                        frame.appendChild(wm);
                        """
                    
                    if js_inject:
                        await page.evaluate(js_inject)

            # Wait for the frame element (code preview container)
            print(f"⏳ Đang chờ render hoàn tất...", file=sys.stderr)
            screenshot_element = page.locator('#frame')
            await screenshot_element.wait_for(state='visible', timeout=15000)

            # Extra wait for animations/rendering
            await page.wait_for_timeout(2000)

            # Create output directory if needed
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)

            # Take screenshot
            print(f"📸 Đang chụp ảnh...", file=sys.stderr)
            await screenshot_element.screenshot(path=output_path)

            print(f"✅ Đã tạo ảnh thành công!", file=sys.stderr)

        except Exception as e:
            print(f"❌ Lỗi: {str(e)}", file=sys.stderr)
            await browser.close()
            sys.exit(1)

        await browser.close()


async def main():
    """Hàm chính"""
    # Parse arguments
    args = parse_arguments()

    # Load config
    config = load_config()

    # Override config với command line arguments
    if args.title:
        config['title'] = args.title
    if args.theme:
        config['theme'] = args.theme
    if args.padding:
        config['padding'] = args.padding
    if args.language:
        config['language'] = args.language
    if args.custom_theme:
        config['custom_theme'] = args.custom_theme

    # Create image
    await create_code_image(args.code, args.output, config)

    # Output file path to stdout (for OpenClaw)
    print(args.output)


if __name__ == "__main__":
    asyncio.run(main())
