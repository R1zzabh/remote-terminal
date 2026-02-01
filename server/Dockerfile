# Server Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Need build tools even for runtime for better-sqlite3 (sometimes) 
# but specifically node-pty needs library support
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
# Note: node-pty might need native rebuild if architecture changes, 
# but here it's built in the same base image.

EXPOSE 3001

CMD ["node", "dist/index.js"]
