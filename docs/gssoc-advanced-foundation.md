# GSSoC Advanced Foundation Notes

This document tracks small foundation work that supports the advanced GSSoC issues opened in June 2026:

- #1158: End-to-end request observability
- #1159: Shared API contract tests
- #1160: Privacy-conscious assessment draft recovery
- #1161: Configurable PHI data retention and erasure workflow
- #1162: Golden clinical scenario tests

## Current foundation

- Queued assessment responses can now carry a support-safe `requestId` from the API boundary into the queue payload.
- The queued assessment response contract includes `requestId` so frontend and backend schema drift is testable.
- Golden tests cover representative low, moderate, and high fallback clinical scenarios with synthetic data only.
- Assessment draft storage utilities enforce versioning, expiration, explicit clearing, and stale-draft removal.

## Follow-up implementation guidance

- Extend request ID propagation to preview, what-if, export, and frontend error states.
- Add route contract tests for auth, export, ML, assessment history, and error responses.
- Wire the draft utility into the assessment form with restore/discard UI.
- Add a backend retention service, migration support, dry-run mode, and audit-safe tombstones.
- Expand golden scenarios with reviewer-approved clinical cases and less brittle recommendation assertions.
