# Stage 1: Build
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install system dependencies needed for native modules and Python ML runtime
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt ./
RUN /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

# Install all Node.js dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the production bundle
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-bookworm-slim

# Set production defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy Python virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Install only production Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built application and required runtime files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/analyze.py ./analyze.py
COPY --from=builder /app/attached_assets ./attached_assets

EXPOSE 3000

# Run the production server
CMD ["npm", "run", "start"]
