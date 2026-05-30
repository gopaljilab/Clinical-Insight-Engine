FROM node:20-bookworm-slim

# Set default runtime environment variables
ENV NODE_ENV=development
ENV PORT=3000
ENV PATH="/app/.venv/bin:$PATH"

# Set working directory inside the container
WORKDIR /app

# Install system dependencies needed for node-postgres, python, and pip package compilation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment under /app/.venv to match getPythonExecutable candidate checks
RUN python3 -m venv /app/.venv

# Copy Python requirements and install in the virtual environment
COPY requirements.txt ./
RUN /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy package definition and install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy all application source files
COPY . .

# Expose the default application port
EXPOSE 3000

# Run the development server by default (can be overridden in docker-compose)
CMD ["npm", "run", "dev"]
