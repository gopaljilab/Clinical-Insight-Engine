## ✦ Description
Add empty state guidance for new users across the Dashboard, History, Analytics, and Admin pages to improve the onboarding experience and clearly explain where data will appear once available.

Fixes #811

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
Previously, new users who had not created any assessments were presented with empty charts, bare tables, and "0" statistics without any context or explanation, creating a confusing and poor onboarding experience.

### Changes Made
- Created a reusable \`EmptyState\` component in \`client/src/components/EmptyState.tsx\`.
- Integrated \`EmptyState\` into the **History page** to guide users to create their first assessment when none are found.
- Integrated \`EmptyState\` into the **Dashboard page** to replace empty statistics cards when no assessments exist.
- Integrated \`EmptyState\` into the **Analytics page** to replace empty charts when there are no population trends available.
- Added \`EmptyState\` to the **Admin Dashboard** for both the Users and Audit Logs tables when they have no records.

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