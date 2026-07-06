# Changelog

All notable changes to **Clinical Insight Engine** will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

_No unreleased additions._

### Changed

_No unreleased changes._

### Fixed

_No unreleased fixes._

### Documentation

_No unreleased documentation updates._

### Security

_No unreleased security updates._

### Planned

- Longitudinal patient risk tracking across multiple assessments
- Counterfactual reasoning engine ("What change reduces risk most?")
- Cohort discovery and population-level insights dashboard
- Integration with Electronic Health Records (EHR) systems
- Advanced bias detection and fairness metrics for ML model
- Cloud deployment support (Vercel / Render)


## [1.0.0] — 2025-05-28

### Added

#### Core Application
- Full-stack clinical decision support system for early diabetes risk detection
- Python-based interpretable machine learning model using Logistic Regression (scikit-learn)
- React + TypeScript frontend with Vite for fast development builds
- Express.js REST API backend with PostgreSQL via Drizzle ORM
- Zod-based schema validation across frontend and backend routes
- TanStack Query for server state management and data fetching

#### Risk Assessment
- Patient intake form accepting: age, gender, hypertension status, heart disease history, smoking history, BMI, HbA1c level, and blood glucose level
- Confidence-aware risk predictions (0–100%) with interpretable factor contributions
- Risk categorisation into LOW / MODERATE / HIGH levels

#### Dual-View Results Interface
- **Clinician View** — exact risk percentage, top contributing factors with impact scores, model confidence indicators, and suggested follow-up actions
- **Patient View** — simplified risk category, plain-language explanations of contributing factors, and preventive lifestyle recommendations

#### Data Visualisation
- Interactive bar charts displaying feature contributions in the clinician view (Recharts)
- Framer Motion animations for smooth UI transitions

#### Assessment History
- Persistent storage of previous assessments with timestamps via PostgreSQL
- Enables longitudinal tracking of individual patient risk over time

#### Machine Learning Pipeline (`analyze.py`)
- Logistic Regression model trained on the diabetes dataset
- Feature engineering and preprocessing pipeline
- StandardScaler normalisation for numeric inputs
- Synthetic data generation fallback (`create_synthetic_data()`) when dataset is unavailable
- Single-patient prediction via `patient.json` file interface (`analyze.py predict_file`)
- Note: `main.py` is a Replit workspace stub and is not part of the ML pipeline

#### Security
- `helmet` middleware for HTTP security headers on all API responses
- `express-rate-limit` for API rate limiting to mitigate abuse
- `express-session` with `connect-pg-simple` for secure, database-backed session storage
- `passport` + `passport-local` for local authentication strategy
- OTP step in the login flow for simulated two-factor verification
- `.env` / `.env.local` separation to prevent secrets from being committed
- Development-only credential bypass is stripped from production builds

#### Developer Experience
- PostgreSQL preflight check on server startup — fails fast with a clear error if the database is unreachable
- Cross-platform setup instructions (Linux, macOS, Windows PowerShell / cmd)
- Python virtual environment support with `requirements.txt`

#### Project Governance
- `README.md` with full setup guide, architecture overview, and feature documentation
- `CONTRIBUTING.md` with contribution guidelines for open-source contributors
- `CODE_OF_CONDUCT.md` based on community standards
- `ANALYSIS_README.md` documenting the ML analysis pipeline
- MIT License

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Framer Motion |
| Backend | Node.js, Express.js, Drizzle ORM, Zod |
| Database | PostgreSQL 14+ |
| ML / Data | Python 3.10+, scikit-learn, pandas, numpy |
| Dev Tools | ESLint, PostCSS, drizzle-kit |

---

## Contributor Guidance

We welcome contributions of all kinds — bug fixes, new features, documentation improvements, and more.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

### How to update this file

Every pull request that changes user-facing behaviour, fixes a bug, or alters a public API should include a changelog entry.

Add your change under the **[Unreleased]** section using the appropriate heading:

| Section | When to use |
|---------|-------------|
| Added | New feature or capability |
| Changed | Modification to existing functionality |
| Deprecated | Feature still works but will be removed in a future release |
| Removed | Feature removed from the project |
| Fixed | Bug fixes |
| Security | Security improvements or fixes |
| Documentation | Documentation-only updates |

**Example**

```md
### Fixed

- Improved assessment history date formatting.
```

### Release Process

When preparing a release:

1. Rename **[Unreleased]** to the new version number.
2. Add the release date.
3. Create a new empty **[Unreleased]** section.
4. Publish the corresponding Git tag and GitHub Release.

### Versioning Policy

This project follows **Semantic Versioning**.

- **PATCH** → Backward-compatible bug fixes
- **MINOR** → New backward-compatible features
- **MAJOR** → Breaking changes

## Links

- Repository: [github.com/gopaljilab/Clinical-Insight-Engine](https://github.com/gopaljilab/Clinical-Insight-Engine)
- Issues: [github.com/gopaljilab/Clinical-Insight-Engine/issues](https://github.com/gopaljilab/Clinical-Insight-Engine/issues)

[Unreleased]: https://github.com/gopaljilab/Clinical-Insight-Engine/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gopaljilab/Clinical-Insight-Engine/releases/tag/v1.0.0
