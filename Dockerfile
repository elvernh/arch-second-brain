FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 py3-pip && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install "youtube-transcript-api>=0.7.0" requests beautifulsoup4

ENV PATH="/opt/venv/bin:$PATH"

COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
CMD ["node", "src/index.js"]
