---
name: code_to_image
description: "Creates a beautiful, shareable image from a code snippet by automating ray.so using Playwright. Supports custom branding themes for LongBest AI."
---

## Usage

```bash
python3 main.py --code "print('hello')" --output out/image.png --custom-theme tech_noir
```

## Arguments

- `--code`: Code snippet to render (required)
- `--output`: Output PNG path (required)
- `--title`: Window title
- `--custom-theme`: Apply a custom branded theme.
  - Default: `tech_noir` (Dark, neon, cyberpunk - LongBest AI brand)
  - Other options: `brutalist`, `clean_future`
