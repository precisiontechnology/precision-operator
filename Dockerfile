FROM ghcr.io/openclaw/openclaw:2026.3.8

USER root

# Bake platform config to staging location
COPY config/workspace/ /home/node/.openclaw-baked/workspace/
COPY config/openclaw.json /home/node/.openclaw-baked/openclaw.json

# Copy skills
COPY skills/ /app/skills/

# Entrypoint handles config overwrite + per-user injection
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN chown -R node:node /home/node/.openclaw-baked

USER node

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "openclaw.mjs", "gateway"]
