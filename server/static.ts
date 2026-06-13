import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist,
  // but return JSON 404 for unknown API routes
  app.get("*", (req, res) => {
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
