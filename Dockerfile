# Multi-stage Dockerfile for Clinical Insight Engine

# Stage 1: Build Node.js application
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD="true"
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Python virtual environment
FROM node:20-bookworm-slim AS python-builder
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /app/.venv
COPY requirements.txt ./
RUN /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

# Stage 3: Production runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV PATH="/app/.venv/bin:$PATH"

# Install Python runtime (no build tools needed)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up non-root user permissions
RUN chown -R node:node /app

# Switch to unprivileged user
USER node

# Copy Python virtual environment from python-builder
COPY --chown=node:node --from=python-builder /app/.venv /app/.venv

# Install production Node.js dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy built application
COPY --chown=node:node --from=builder /app/dist ./dist

# Copy ML inference script and data assets
COPY --chown=node:node analyze.py ./
COPY --chown=node:node attached_assets ./attached_assets

EXPOSE 5000
CMD ["node", "dist/index.cjs"]
