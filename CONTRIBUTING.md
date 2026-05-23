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

5. Create and activate a Python virtual environment, then install ML dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate the environment with:

```powershell
.\.venv\Scripts\Activate.ps1
```

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

## Community Expectations

Be respectful, patient, and constructive in issues, reviews, and pull requests. Assume good intent, explain technical tradeoffs clearly, and help keep the project welcoming for new contributors.
