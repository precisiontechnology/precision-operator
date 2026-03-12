FROM ghcr.io/openclaw/openclaw:2026.3.8

USER root

# Bake platform config
COPY config/workspace/ /home/node/.openclaw-baked/workspace/
COPY config/openclaw.json /home/node/.openclaw-baked/openclaw.json

# Copy skills
COPY skills/ /app/skills/

# Fix ownership BEFORE switching to node
RUN chown -R node:node /home/node/.openclaw-baked

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node

# Install mem0 plugin to baked location (same pattern as precision plugin)
RUN npm pack @mem0/openclaw-mem0 && \
    mkdir -p /home/node/.openclaw-baked/workspace/plugins/openclaw-mem0 && \
    tar -xzf mem0-openclaw-mem0-*.tgz -C /home/node/.openclaw-baked/workspace/plugins/openclaw-mem0 --strip-components=1 && \
    rm mem0-openclaw-mem0-*.tgz && \
    cd /home/node/.openclaw-baked/workspace/plugins/openclaw-mem0 && npm install --omit=dev

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "openclaw.mjs", "gateway"]
