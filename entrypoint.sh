#!/bin/bash
set -e

echo "=== ENTRYPOINT START ==="
echo "PWD: $(pwd)"
echo "USER: $(whoami)"

mkdir -p /home/node/.openclaw/workspace

echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

if [ -n "$PRECISION_USER_NAME" ]; then
  echo "Injecting user context for: $PRECISION_USER_NAME"
  cat > /home/node/.openclaw/workspace/USER.md << EOF
# USER.md - $PRECISION_USER_NAME

## Business Context
$PRECISION_USER_CONTEXT

## Account ID
$PRECISION_ACCOUNT_ID
EOF
fi

chown -R node:node /home/node/.openclaw 2>/dev/null || true

echo "=== ENV CHECK ==="
echo "TELEGRAM_BOT_TOKEN set: $([ -n \"$TELEGRAM_BOT_TOKEN\" ] && echo 'yes' || echo 'NO')"
echo "ANTHROPIC_API_KEY set: $([ -n \"$ANTHROPIC_API_KEY\" ] && echo 'yes' || echo 'NO')"

echo "=== STARTING OPENCLAW ==="
exec "$@"