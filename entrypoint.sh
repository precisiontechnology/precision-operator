#!/bin/bash
set -e

echo "=== ENTRYPOINT START ==="
mkdir -p /home/node/.openclaw/workspace

echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

chown -R node:node /home/node/.openclaw 2>/dev/null || true

echo "=== NETWORK TEST ==="
echo "DNS resolve:"
getent hosts api.telegram.org || echo "DNS FAILED"
echo "Curl test:"
curl -s --max-time 5 https://api.telegram.org -o /dev/null && echo "Telegram reachable" || echo "Telegram UNREACHABLE"

echo "=== CONFIG ==="
cat /home/node/.openclaw/openclaw.json

echo "=== STARTING OPENCLAW ==="
node openclaw.mjs gateway 2>&1 < /dev/null &
PID=$!
echo "Started with PID: $PID"

sleep 10
echo "=== AFTER 10s, checking if alive ==="
ps aux | grep node || echo "Node not running"

sleep infinity