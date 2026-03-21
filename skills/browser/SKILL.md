---
name: browser
description: Take screenshots of websites. Use when user asks to screenshot, capture, or show them any webpage or URL.
---

# Browser Screenshots Skill

## CRITICAL: Screenshot URL in reply

When the screenshot tool result contains a URL (e.g. `https://pub-*.r2.dev/...`), you MUST include it in your reply as a markdown image:

```
![Screenshot](https://the-url-from-tool-result)
```

Do NOT just say "here's the screenshot" — the user cannot see the image unless you include the URL as markdown.

## Taking Screenshots

For a simple viewport screenshot, use ONE tool call with all parameters:

```
browser screenshot --navigate <url> --width 1920 --height 1080
```

Do NOT call open, resize, and screenshot separately. Use `--navigate` to combine them.

For a full page screenshot:
```
browser screenshot --navigate <url> --width 1920 --height 1080 --full-page
```

## Defaults
- No preference = viewport only
- Always use --navigate with the URL in the screenshot call
- Do NOT ask the user how they want it unless they specifically ask for options
