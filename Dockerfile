FROM ghcr.io/openclaw/openclaw:2026.3.8

USER root

# Copy config directly to .openclaw (no baked indirection)
COPY config/workspace/ /home/node/.openclaw/workspace/
COPY config/openclaw.json /home/node/.openclaw/openclaw.json

# Copy skills
COPY skills/ /app/skills/

# Fix ownership
RUN chown -R node:node /home/node/.openclaw

USER node

# Install mem0 plugin
RUN openclaw plugins install @mem0/openclaw-mem0

# No entrypoint needed - just run gateway
CMD ["node", "openclaw.mjs", "gateway"]
