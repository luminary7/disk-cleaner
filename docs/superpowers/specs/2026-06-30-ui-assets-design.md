# UI Assets Design

## Goal

Generate a project-local UI asset pack for the C drive cleaner desktop app.
The assets should support category cards, empty states, scan states, safety prompts, and AI analysis surfaces.

## Approved Direction

- Asset pack: category and status UI assets.
- Style: soft light 3D, matching the existing blue-green glassy assets in `src/assets`.
- Usage: internal app UI assets, not store or marketing screenshots.
- Output folder: `src/assets/ui-kit/`.
- Existing files must not be overwritten.

## Assets

| File | Size | Usage |
| --- | --- | --- |
| `temp-cache.png` | 1024x1024 | Temporary files and cache cleanup category |
| `browser-cache.png` | 1024x1024 | Browser cache category |
| `app-cache.png` | 1024x1024 | App cache and app data category |
| `system-cache.png` | 1024x1024 | System cache and caution category |
| `large-file.png` | 1024x1024 | Large file analysis category |
| `ai-analysis.png` | 1024x1024 | AI analysis and smart suggestion state |
| `scan-state.png` | 1312x736 | Scanning and disk inspection state |
| `safe-clean.png` | 1312x736 | Safe cleanup and success state |
| `caution-protect.png` | 1312x736 | Caution, protected files, and keep recommendations |

## Visual Rules

- Use a white or very light blue-green background.
- Use blue and green as the primary palette.
- Use orange, red, and purple only for semantic differentiation.
- Avoid all visible text, labels, numbers, watermarks, logos, or UI screenshots.
- Keep shapes clear enough for card thumbnails.
