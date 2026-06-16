# Helmet Configuration

## Purpose
We use `helmet` in the Express application to set secure HTTP response headers, mitigating well-known web vulnerabilities like XSS, Clickjacking, and MIME sniffing.

## Configuration Defaults
Our global Express middleware setup uses `helmet()` with strict Content Security Policies (CSP) configured for a modern React frontend.

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api.cardioguard.ai"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allows external images if needed
}));
```

## Maintenance
If new external assets (fonts, images, CDNs) are added to the frontend, the CSP `directives` block in the backend `helmet` configuration MUST be updated to whitelist the new domains.
