declare module "compression" {
  import type { RequestHandler } from "express";
  const compression: () => RequestHandler;
  export default compression;
}

declare module "sanitize-html" {
  export default function sanitizeHtml(input: string, options?: any): string;
}

declare module "node-cron" {
  export default {
    schedule: (...args: any[]) => ({ stop: () => void 0 }) as any,
  };
}

