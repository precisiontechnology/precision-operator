#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp /home/node/.openclaw-baked/exec-approvals.json /home/node/.openclaw/exec-approvals.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

if [ -n "$PRECISION_DEVICE_ID" ] && [ -n "$PRECISION_DEVICE_PUBLIC_KEY" ]; then
  DEVICE_DIR="$HOME/.openclaw/gateway/devices"
  mkdir -p "$DEVICE_DIR"
  cat > "$DEVICE_DIR/$PRECISION_DEVICE_ID.json" <<DEVICE_EOF
{
  "id": "$PRECISION_DEVICE_ID",
  "publicKey": "$PRECISION_DEVICE_PUBLIC_KEY",
  "name": "precision-backend",
  "role": "operator",
  "registeredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
DEVICE_EOF
fi

exec "$@"
