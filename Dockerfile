FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-noto-color-emoji fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
