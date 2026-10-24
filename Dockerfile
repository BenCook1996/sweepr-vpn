FROM node:24-bookworm-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY website ./website

ENV NODE_ENV=production
ENV PORT=8080
ENV TRUST_CLOUDFLARE=true
EXPOSE 8080

USER node

CMD ["node", "website/server.mjs"]
