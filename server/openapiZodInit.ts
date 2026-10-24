import { createRequire } from "node:module";
import { z } from "zod/v4";

export const openApiRequire = createRequire(
  typeof __filename === "string" ? __filename : `${process.cwd()}/package.json`
);

export let extendZodWithOpenApi: ((zod: typeof z) => void) | undefined;

try {
  ({ extendZodWithOpenApi } = openApiRequire("@asteasolutions/zod-to-openapi"));
  extendZodWithOpenApi?.(z);
} catch {
  // Keep OpenAPI optional when its tooling dependency is unavailable.
}
