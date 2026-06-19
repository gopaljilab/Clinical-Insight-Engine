## ✦ Description
Implement comprehensive API rate limiting, strict JSON request payload size limits, and clean up domain routes to enhance backend security and robustness under production loads.

Fixes #1433

---

## ⟡ Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update (non-breaking change to docs)

---

## ✦ Description of Changes

### 1. API Rate Limiting
- Applied `express-rate-limit` middleware systematically across all standard and sensitive endpoints.
- Added and calibrated custom rate limiters:
  - `previewLimiter` (10 reqs/min) for what-if simulation and preview.
  - `assessmentLimiter` (5 reqs/min) for single assessment creation.
  - `uploadLimiter` (5 reqs/min) for CSV bulk uploads.
  - `mlLimiter` (20 reqs/min) for model versioning and dataset metrics.
  - Consolidation of `authLimiter` and `strictAuthLimiter` inside the auth router.

### 2. Payload Validation & Size Limits
- Configured a strict global request body-size limit of `10kb` on all JSON endpoints to prevent Denial-of-Service (DoS) attacks via memory exhaustion.
- Registered a route-specific override of `1mb` for the bulk import route (`POST /api/assessments/bulk`) to support large dataset ingestion.

### 3. Route Refactoring & Consolidation
- Cleaned up `server/routes.ts` by extracting monolithic inline route handlers into modular domain routers:
  - `mlRouter`
  - `exportsRouter`
  - `analyticsRouter`
  - `assessmentsRouter`
- Reordered router registrations to prevent collision from parameterized route matching (e.g. ensuring `/:id` does not capture endpoints like `/analytics` or `/export.csv`).

### 4. Tests & Quality Alignment
- Fixed test suites to match database-backed OTP attempt logic where lockout occurs on the 6th failed verification attempt.
- Updated the express-rate-limit test mock to isolate counter states per limiter instance to prevent tests from failing on shared IP limits.
- Ensured 100% of Vitest integration and unit tests pass successfully.

---

## ✦ Checklist
- [x] My code follows the style guidelines of this project.
- [x] I have performed a self-review of my code.
- [x] My changes generate no new warnings or console errors.
- [x] All automated tests pass successfully (`npm run test`).
- [x] TypeScript compilation succeeds without errors (`npm run check`).
