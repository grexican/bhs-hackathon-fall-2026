# The official Playwright image already has Chromium and every system library it needs, so the
# build's browser test runs the same here as on a laptop. Its version must match package.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.js"]
