#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

# ALWAYS copy platform config (ensures updates propagate on redeploy)
echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

# Inject per-user data if provided via env vars
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

# Fix permissions (ignore errors on lost+found)
chown -R node:node /home/node/.openclaw 2>/dev/null || true

exec "$@"