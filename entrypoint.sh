#!/bin/bash
set -e

echo "=== ENTRYPOINT START ==="
mkdir -p /home/node/.openclaw/workspace

echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

chown -R node:node /home/node/.openclaw 2>/dev/null || true

echo "=== CHECKING OPENCLAW ==="
node -e "console.log('Testing import...'); import('./dist/cli/index.js').then(() => console.log('Import OK')).catch(e => console.error('Import failed:', e))"

echo "=== TRYING OPENCLAW VERSION ==="
node openclaw.mjs --version 2>&1 || echo "Version check failed: $?"

echo "=== STARTING OPENCLAW ==="
node openclaw.mjs gateway 2>&1 < /dev/null || echo "EXIT CODE: $?"