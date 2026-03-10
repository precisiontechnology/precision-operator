---
name: browser
description: Take screenshots of websites. Use when user asks to screenshot, capture, or show them any webpage or URL.
---

# Browser Screenshots Skill

## Before Any Screenshot

Ask what they want:

"How do you want this screenshot?
1. Viewport - just whats visible (1920x1080)
2. Full page (single) - entire page stitched
3. Full page (chunked) - series of viewport images

Or name a section (hero, pricing, footer) to scroll there first."

## Viewport Only
browser resize 1920 1080
browser open <url>
browser wait --load networkidle
browser screenshot
## Full Page Single
browser resize 1920 1080
browser open <url>
browser wait --load networkidle
browser evaluate --fn "() => window.scrollTo(0, document.body.scrollHeight)"
browser wait --time 2000
browser evaluate --fn "() => window.scrollTo(0, 0)"
browser wait --time 500
browser screenshot --full-page
## Full Page Chunked
browser resize 1920 1080
browser open <url>
browser wait --load networkidle
browser evaluate --fn "() => window.scrollTo(0, document.body.scrollHeight)"
browser wait --time 2000
browser evaluate --fn "() => window.scrollTo(0, 0)"
browser wait --time 500
browser screenshot --full-page /tmp/fullpage.png
convert /tmp/fullpage.png -crop 1920x1080 +repage /tmp/chunk-%d.png
Send each chunk file in sequence.

## Specific Section
browser resize 1920 1080
browser open <url>
browser wait --load networkidle
browser snapshot
browser scrollintoview <ref>
browser wait --time 500
browser screenshot
## Defaults

- No preference = viewport only
- Always resize 1920x1080 first
- Always wait for networkidle
