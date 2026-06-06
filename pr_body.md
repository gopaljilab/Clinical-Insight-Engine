## ✦ Description
Implement a robust React Error Boundary to prevent the application from crashing into a blank screen. This includes a user-friendly fallback UI with recovery options and automatic error logging to the backend for developer visibility.

Fixes #810

---

## ⟡ Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update (non-breaking change to docs)
- [ ] Code styling/formatting (prettier, eslint, spacing)

---

## ✦ Checklist
- [x] My code follows the style guidelines of this project.
- [x] I have performed a self-review of my code.
- [x] I have commented my code, particularly in hard-to-understand areas.
- [x] My changes generate no new warnings or console errors.
- [x] I have verified that my changes work correctly on both desktop and mobile viewports.
- [x] (If applicable) I have run npm run lint and npm run format locally before pushing.

---

## ⟡ Screenshots / Screen Recordings (Required for UI changes)

N/A

---

## Description

### Root Cause
Previously, unhandled runtime errors in React components would bubble up to the root, unmounting the entire application tree and leaving users with a blank white screen, with no automated way for developers to be notified.

### Changes Made
- Expanded \`client/src/components/ErrorBoundary.tsx\` to include a stylized fallback UI with a "Reload Page" button and "Contact Support" mailto link.
- Implemented automatic logging of client errors (including component stack traces) to a new \`POST /api/logs/client-error\` endpoint via \`fetch\`.
- Added the new logging endpoint to \`server/routes.ts\` using the unified Pino logger.
- Wrapped the \`Dashboard.tsx\` component in a route-level \`ErrorBoundary\` to ensure failures on the dashboard don't crash the navigation layout.
- Kept the root-level boundary in \`App.tsx\`.

### Testing Performed
\`bash
npm run check
\`

### Result
PASS — 0 TypeScript errors found, components compile correctly.

---

## Type of change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] This change requires a documentation update

---

## Checklist:
- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas