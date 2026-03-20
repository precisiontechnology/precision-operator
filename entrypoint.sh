#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp /home/node/.openclaw-baked/exec-approvals.json /home/node/.openclaw/exec-approvals.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

if [ -n "$PRECISION_DEVICE_ID" ] && [ -n "$PRECISION_DEVICE_PUBLIC_KEY" ]; then
  mkdir -p "$HOME/.openclaw/devices"
  cat > "$HOME/.openclaw/devices/paired.json" <<DEVICE_EOF
{
  "$PRECISION_DEVICE_ID": {
    "deviceId": "$PRECISION_DEVICE_ID",
    "publicKey": "$PRECISION_DEVICE_PUBLIC_KEY",
    "name": "precision-backend",
    "role": "operator",
    "roles": ["operator"],
    "scopes": ["operator.read", "operator.write", "operator.admin"]
  }
}
DEVICE_EOF
fi

exec "$@"
