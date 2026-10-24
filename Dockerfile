# Multi-stage Dockerfile for Clinical Insight Engine

# Stage 1: Build Node.js application
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD="true"
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Build Python virtual environment
FROM node:22-bookworm-slim AS python-builder
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
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV PATH="/app/.venv/bin:$PATH"
ENV EXPECTED_MODEL_SHA256=146f09587948dbc570800bb242baf4b7dd6a9a5e509c6d7bc84828ea12bc1264

# Install Python runtime (no build tools needed)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set up non-root user permissions
RUN chown -R node:node /app

# Switch to unprivileged user
USER node

# Copy Python virtual environment from python-builder
COPY --chown=node:node --from=python-builder /app/.venv /app/.venv

# Install production Node.js dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built application
COPY --chown=node:node --from=builder /app/dist ./dist
# connect-pg-simple resolves its bundled session table relative to the bundled
# server entrypoint (__dirname is /app/dist in the production build).
COPY --chown=node:node --from=builder /app/node_modules/connect-pg-simple/table.sql ./dist/table.sql

# Package the verified model, signature, and manifest used by this release.
COPY --chown=node:node diabetes_model.pkl diabetes_model.pkl.sig diabetes_model.pkl.manifest.json ./

# Copy ML inference script and data assets
COPY --chown=node:node analyze.py ./
COPY --chown=node:node attached_assets ./attached_assets
COPY --chown=node:node app ./app
COPY --chown=node:node services ./services
COPY --chown=node:node validation ./validation
COPY --chown=node:node diabetes_dataset.csv ./diabetes_dataset.csv

EXPOSE 5000
CMD ["node", "dist/index.cjs"]
