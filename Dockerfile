FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server ./server

USER node
EXPOSE 8787
CMD ["node", "server/server.js"]
