FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages youtube-transcript-api

COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
CMD ["node", "src/index.js"]
