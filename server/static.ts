import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

function injectNonce(html: string, nonce: string): string {
  if (!nonce) return html;
  return html
    .replace(/<script\b/gi, `<script nonce="${nonce}"`)
    .replace(/<link\b/gi, `<link nonce="${nonce}"`)
    .replace(
      /<meta name="csp-nonce" content="[^"]*"/,
      `<meta name="csp-nonce" content="${nonce}"`,
    );
}

export function serveStatic(
  app: Express,
  distPath = path.resolve(process.cwd(), "dist", "public"),
) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Let the SPA fallback serve index.html so its inline scripts receive the
  // same nonce that Helmet placed in the response's CSP header.
  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist,
  // but return JSON 404 for unknown API routes
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "API endpoint not found" });
    }
    let html = fs.readFileSync(
      path.resolve(distPath, "index.html"),
      "utf-8",
    );
    html = injectNonce(html, res.locals.cspNonce);
    res.type("html").send(html);
  });
}
