FROM ghcr.io/openclaw/openclaw:2026.3.8

USER root

# Copy config directly to .openclaw
COPY config/workspace/ /home/node/.openclaw/workspace/
COPY config/openclaw.json /home/node/.openclaw/openclaw.json

# Copy skills
COPY skills/ /app/skills/

# Fix ownership
RUN chown -R node:node /home/node/.openclaw

USER node

# Install mem0 plugin as file path (same pattern as precision plugin)
RUN npm pack @mem0/openclaw-mem0 && \
    mkdir -p /home/node/.openclaw/workspace/plugins/openclaw-mem0 && \
    tar -xzf mem0-openclaw-mem0-*.tgz -C /home/node/.openclaw/workspace/plugins/openclaw-mem0 --strip-components=1 && \
    rm mem0-openclaw-mem0-*.tgz && \
    cd /home/node/.openclaw/workspace/plugins/openclaw-mem0 && npm install --omit=dev

CMD ["node", "openclaw.mjs", "gateway"]
