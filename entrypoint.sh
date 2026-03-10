#!/bin/bash
set -e

echo "=== ENTRYPOINT START ==="
mkdir -p /home/node/.openclaw/workspace

echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

chown -R node:node /home/node/.openclaw 2>/dev/null || true

echo "=== ENV CHECK ==="
echo "TELEGRAM_BOT_TOKEN set: $([ -n \"$TELEGRAM_BOT_TOKEN\" ] && echo 'yes' || echo 'NO')"
echo "ANTHROPIC_API_KEY set: $([ -n \"$ANTHROPIC_API_KEY\" ] && echo 'yes' || echo 'NO')"

echo "=== NODE VERSION ==="
node --version

echo "=== TESTING NODE ==="
node -e "console.log('Node works!')"

echo "=== STARTING OPENCLAW (with crash capture) ==="
node openclaw.mjs gateway 2>&1 || echo "EXIT CODE: $?"