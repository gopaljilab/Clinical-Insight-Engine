## ✦ Description
Add a destructive confirmation dialog when deleting a patient assessment from the History page to prevent accidental data loss. This adds a layer of friction for permanent actions while maintaining a smooth user experience through optimistic updates and loading states.

Fixes #812

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
Deleting an assessment was previously an immediate action without confirmation, which could lead to accidental and irreversible data loss of patient records.

### Changes Made
- Created a reusable \`ConfirmDeleteDialog\` component in \`client/src/components/ConfirmDeleteDialog.tsx\` using shadcn/ui Alert Dialog primitives.
- Integrated the \`ConfirmDeleteDialog\` into the actions column of the History page table.
- Created a \`useDeleteAssessment\` hook in \`client/src/hooks/use-assessments.ts\` using React Query to handle the API call, success/error toast notifications, and cache invalidation.
- Implemented the \`DELETE /api/assessments/:id\` endpoint in \`server/routes/assessments.routes.ts\`.
- Added \`deleteAssessment\` to the \`storage\` layer (\`server/storage.ts\` and \`server/repositories/assessment.repository.ts\`).
- Included security checks (IDOR protection) in the delete endpoint to ensure a user can only delete assessments they created.

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
