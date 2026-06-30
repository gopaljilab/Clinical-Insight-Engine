# Contributing to Clinical Insight Engine

Thank you for helping improve Clinical Insight Engine. This project combines a React/TypeScript frontend, an Express API, PostgreSQL persistence, and a Python machine learning inference script, so focused and well-tested changes are especially helpful.

## Before You Start

- Read the README setup instructions and run the project locally if your change affects runtime behavior.
- Check existing issues and pull requests to avoid duplicate work.
- For issue-based contributions, comment with a short implementation plan before opening a pull request.
- Keep each pull request focused on one issue or one closely related improvement.

## Local Setup

1. Fork the repository and clone your fork.
2. Install Node dependencies:

```bash
npm install
```

3. Create a `.env` file with the required database connection:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clinical_insight_engine
```

4. Set up PostgreSQL and apply database changes:

```bash
npm run db:push
```

5. Add local-only clinician credentials for frontend authentication testing in `.env.local`:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

DEV_CLINICIAN_EMAIL=developer@cardioguard.local
DEV_CLINICIAN_PASSWORD=DevSecurePassword123!

NEXT_PUBLIC_LOCAL_ENCRYPTION_KEY=your_local_32_character_secret_key_here
```

These values are for local development only. The authentication UI must not show seeded credentials publicly, and production builds must not depend on local credential bypass behavior.

6. Create and activate a Python virtual environment, then install ML dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate the environment with:

```powershell
.\.venv\Scripts\Activate.ps1
```

## Developer Authentication Workflow

- Use the login form with credentials from `.env.local` when testing locally.
- Preserve the login, register, OTP, and dashboard redirect flow unless your issue explicitly targets authentication UX.
- Keep the development-only credential notice subtle and hidden in production.
- Do not commit `.env`, `.env.local`, screenshots containing credentials, or any seeded credential values outside setup documentation.
- If you change auth UI behavior, verify both `/` and `/dashboard` still render locally.

## Development Workflow

1. Create a branch from the latest default branch:

```bash
git checkout -b fix/short-description
```

2. Make the smallest useful change that solves the issue.
3. Avoid committing generated files, local environment files, caches, or datasets unless the issue explicitly requires them.
4. Use clear commit messages, for example:

```bash
git commit -m "fix: handle ML prediction timeout"
git commit -m "docs: add setup troubleshooting notes"
```

## Validation

Run the checks that match your change:

```bash
npm run check
```

For Python-only changes, also run:

```bash
python -m py_compile analyze.py main.py
```

If your change touches the ML prediction flow, manually verify that `analyze.py` still accepts the expected input data and returns valid JSON output for the Node backend.

If you cannot run a check because of a local dependency such as PostgreSQL, mention that clearly in your pull request.

## Pull Request Guidelines

- Link the issue in the pull request body with `Fixes #issue-number` when applicable.
- Summarize what changed and why.
- List the validation commands you ran.
- Include screenshots for UI changes.
- Do not mix unrelated formatting, refactors, or dependency updates into a small issue fix.
- Be responsive to maintainer feedback and keep discussion on the pull request thread.

## Code Style

- Prefer readable TypeScript and Python over clever shortcuts.
- Keep API responses structured and predictable.
- Preserve the educational and research-only medical disclaimer.
- Do not expose secrets, database URLs, personal health data, or local `.env` values in commits.

## Dashboard UI Contribution Guidelines

- Use Tailwind classes consistently with the existing React components.
- Prefer Lucide icons for navigation, action buttons, clinical states, and empty/loading states.
- Keep focus rings visible with `focus:ring-4` and blue-tinted focus states for interactive controls.
- Preserve the two-column dashboard form layout on desktop and the single-column flow on mobile.
- Use `#2563EB` or Tailwind `blue-600` for primary actions and active clinical UI states.
- Make toggle state visible through color, motion, and knob position; active toggles should read clearly as enabled.
- Keep accessibility in mind: labels, button text, keyboard focus, contrast, and non-color state cues all matter.
- Maintain the enterprise healthcare SaaS tone: minimal, clinical, trustworthy, spacious, and polished.

## Accessibility Contribution Guidelines

Changes that affect UI components or user interaction must meet these accessibility standards:

### Focus & Keyboard
- Modals and dialogs **must** trap focus (Tab/Shift+Tab cycle) and close on Escape
- Dropdowns, menus, and autocomplete widgets **must** support ArrowDown/ArrowUp navigation and Escape dismiss
- Interactive elements **must** have visible `:focus-visible` outlines (minimum 2px offset)
- Tab order must follow the visual layout (logical DOM order)

### ARIA
- Use semantic HTML elements or apply explicit ARIA roles (`dialog`, `combobox`, `listbox`, `option`, `alert`, `alertdialog`)
- Interactive search/combobox inputs must include:
  - `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` on the input
  - `role="listbox"` on the suggestion container
  - `role="option"` and `aria-selected` on each suggestion item
- Use `aria-describedby` for error messages, `aria-invalid` for validation state
- Dynamic content changes must use `role="alert"` or `aria-live` regions

### Navigation
- Every page **must** include a "Skip to main content" link as the first focusable element
- The skip link must be hidden (`sr-only`) by default and visible on keyboard focus
- A `#main-content` anchor must wrap the primary page content

### Visual & Contrast
- Color is never the sole indicator of state (use text, icons, or patterns alongside color)
- Text must meet WCAG 2.1 AA contrast ratio (4.5:1, 3:1 for large text)
- Interactive focus indicators must have contrast of at least 3:1 against adjacent colors

### Reduced Motion
- Use `prefers-reduced-motion` media queries for animations and transitions
- Avoid automatic movement, blinking, or auto-playing content

### Testing
- Run Playwright E2E tests before opening a pull request for UI changes:
  ```bash
  npx playwright test tests/e2e/keyboard-navigation.spec.ts
  ```
- New UI features should include Playwright tests that verify keyboard interaction and use `@axe-core/playwright` for automated WCAG auditing

## Community Expectations

Be respectful, patient, and constructive in issues, reviews, and pull requests. Assume good intent, explain technical tradeoffs clearly, and help keep the project welcoming for new contributors.
