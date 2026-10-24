import { afterAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { serveStatic } from "./static";

const distPath = mkdtempSync(path.join(tmpdir(), "clinical-insight-static-"));
mkdirSync(path.join(distPath, "assets"));
writeFileSync(
  path.join(distPath, "index.html"),
  '<html><head><meta name="csp-nonce" content=""><script>window.booted = true;</script></head><body><div id="root"></div></body></html>',
);
writeFileSync(path.join(distPath, "assets", "app.js"), "window.appLoaded = true;");

const app = express();
app.use((_req, res, next) => {
  res.locals.cspNonce = "test-nonce";
  next();
});
serveStatic(app, distPath);

afterAll(() => {
  rmSync(distPath, { recursive: true, force: true });
});

describe("serveStatic", () => {
  it("serves the SPA document through the nonce-injecting fallback", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain('<script nonce="test-nonce">');
    expect(response.text).toContain('<meta name="csp-nonce" content="test-nonce"');
  });

  it("continues to serve static assets directly", async () => {
    const response = await request(app).get("/assets/app.js");

    expect(response.status).toBe(200);
    expect(response.text).toBe("window.appLoaded = true;");
  });
});
