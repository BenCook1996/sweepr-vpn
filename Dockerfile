FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY website ./website

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "website/server.mjs"]
