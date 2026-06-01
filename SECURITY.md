# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take the security of **Clinical-Insight-Engine** seriously. If you discover a security vulnerability, please help us responsibly disclose it.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report them via one of the following methods:

1. **GitHub Private Vulnerability Reporting** (preferred): Use the [Security Advisories](../../security/advisories/new) feature on this repository.
2. **Email**: Contact the maintainer directly via their GitHub profile contact.

### What to Include

When reporting a vulnerability, please include:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected versions or components
- Any suggested mitigation or fix (optional)

### Response Timeline

- **Acknowledgement**: Within 48 hours of your report
- **Status Update**: Within 7 days
- **Fix / Patch**: We aim to address critical vulnerabilities within 30 days

We appreciate your efforts to keep this project and its users safe. Thank you for practicing responsible disclosure! 🙏

## Clinical Data Security Categories

| Threat | Examples | Priority |
|--------|---------|---------|
| Patient data exposure | Unmasked PII, exposed record fields | CRITICAL |
| Auth bypass | Forged session cookies, weak SECRET_KEY | HIGH |
| ML model manipulation | Adversarial inputs skewing predictions | HIGH |
| File upload abuse | Executable files disguised as CSV/PDF | HIGH |
| Audit trail tampering | Modified or deleted prediction logs | HIGH |
| Unvalidated inputs | Missing schema validation on patient data | MEDIUM |

## Severity and Response SLA

| Severity | CVSS Range | Response Time | Fix Deadline |
|----------|-----------|--------------|-------------|
| **Critical** | 9.0–10.0 | 24 hours | 72 hours |
| **High** | 7.0–8.9 | 48 hours | 1 week |
| **Medium** | 4.0–6.9 | 5 days | Next release |
| **Low** | 0.1–3.9 | 2 weeks | Backlog |

## Reporting

**Do NOT open public GitHub issues for security vulnerabilities.**

Report privately via:
1. GitHub Security Advisory (Security tab → Report a vulnerability)
2. Email the maintainer directly

Include: affected component, severity assessment, reproduction steps, and patient data impact.
