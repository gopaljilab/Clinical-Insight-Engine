import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import fhirRouter from "./fhir.routes";

describe("FHIR parse route", () => {
  it("is mounted at /api/ingest/fhir/parse", () => {
    const registeredParseRoute = (fhirRouter as any).stack.find(
      (layer: any) => layer.route?.path === "/fhir/parse" && layer.route.methods.post,
    );
    const routeMountSource = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const clientSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/SmartFhirConnect.tsx"), "utf8");

    expect(registeredParseRoute).toBeDefined();
    expect(routeMountSource).toMatch(/app\.use\("\/api\/ingest",\s*fhirRouter\)/);
    expect(clientSource).toContain('ApiClient.post("/api/ingest/fhir/parse", bundle)');
  });
});
