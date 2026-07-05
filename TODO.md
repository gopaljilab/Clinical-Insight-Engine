# TODO - Clinical Insight Engine

## Plan scope
Fix both:
1) TypeScript errors reported by `tsc-output-2.txt` so `tsc` succeeds.
2) Build-time warnings (duplicate key `ignoreDeprecations`, `import.meta` in `cjs`, chunkSizeWarningLimit note, and hardlink/link-mode warning if applicable).

## Steps
- [ ] Inspect exact failing locations from `tsc-output-2.txt` and confirm current code context.
- [ ] Patch `client/src/components/ui/form.tsx` to avoid unsafe cast of `FieldError` to `Error`.
- [ ] Patch `client/src/lib/queryClient.ts` to safely handle `catch (error: unknown)`.
- [ ] Patch `server/middleware/validateDTO.ts` to format Zod errors without casting to `Error`.
- [ ] Patch `server/queue.ts` to handle `unknown` errors properly and ensure any referenced helpers exist.
- [ ] Patch `server/routes.ts` to fix `getQueueMetrics` reference and `unknown` error formatting.
- [ ] Patch `server/services/fhirParser.ts` to safely handle `unknown` errors.
- [ ] Re-run `npx tsc` (or `npm run check` if it does not run tsc) and fix remaining TS errors until clean.
- [ ] Fix Vite/build warning causes:
  - [ ] Remove duplicate `ignoreDeprecations` in `tsconfig.json`.
  - [ ] Adjust server bundling/esbuild config to avoid `import.meta` usage in CJS output (if present via dependency usage, suppress/transform).
  - [ ] If needed, set `build.chunkSizeWarningLimit`.
  - [ ] If hardlink warning can be suppressed, set `UV_LINK_MODE=copy` for build script (or pass link-mode=copy).
- [ ] Re-run `npm run build` and confirm warnings reduced.
- [ ] Run `npm test` (vitest) and optionally `npm run test:e2e` if feasible.

