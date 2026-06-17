# Production Deployment Guide

## Architecture Overview
The application follows a standard decoupled architecture, deployed via containerized environments.
- **Frontend:** React (Vite) static build, served via Nginx or CDN.
- **Backend:** Node.js (Express) containerized service.
- **Database:** PostgreSQL (Neon / RDS).

## Environment Configuration
Production environments must enforce the following environment variables:
```env
NODE_ENV=production
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
SESSION_SECRET=<secure_generated_random_string>
CORS_ORIGIN=https://app.cardioguard.ai
```

## Scaling Strategy
- The Node.js backend should be deployed with PM2 in cluster mode (`pm2 start dist/index.js -i max`) or managed by Kubernetes HPA (Horizontal Pod Autoscaler) to handle concurrent ML request loads.
- Ensure the ML service requests have appropriate timeouts (typically 5000ms max) to prevent thread pool exhaustion.

> [!IMPORTANT]
> Never expose `DATABASE_URL` or API keys to the frontend build process. Ensure all production database connections enforce SSL.