# Docker Multi-Stage Builds

## Philosophy
To minimize the attack surface area and dramatically reduce the final image size of the container, we employ a multi-stage Docker build process. 

## Build Stages

1. **Builder Stage (`node:20-alpine`)**
   - Installs all dependencies (including `devDependencies` like TypeScript, Vite).
   - Runs `npm run build` to transpile TypeScript to JavaScript in `dist/`.
   - Builds the React frontend bundle.

2. **Prune Stage**
   - Runs `npm prune --production` to remove development dependencies from `node_modules/`.

3. **Runtime Stage (`node:20-alpine`)**
   - Copies ONLY the `dist/` directory, `public/` directory, and the pruned `node_modules/` from the previous stages.
   - Sets the user to a non-root `node` user for security.
   - Exposes port 5000 and runs `npm start`.

## Example Execution
```bash
# Build the image
docker build -t cardioguard/backend:latest .

# Run locally for testing
docker run -p 5000:5000 --env-file .env cardioguard/backend:latest
```
