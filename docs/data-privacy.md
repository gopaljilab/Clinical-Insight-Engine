# Data Privacy and HIPAA Guidelines

Guidelines for securing patient record values, tokens, and medical files in compliance with HIPAA mandates.

## Retention Policy Defaults

The backend exposes a typed retention policy helper in `server/services/data-retention-policy.ts`.
It does not delete records by itself; it centralizes the default windows and eligibility decisions that cleanup jobs, admin tools, or future erasure endpoints can reuse.

Default retention windows:

- Assessments: 7 years
- Patient records: 7 years
- Generated exports and temporary export artifacts: 30 days
- Audit metadata: 10 years

Supported environment overrides:

- `ASSESSMENT_RETENTION_DAYS`
- `PATIENT_RETENTION_DAYS`
- `EXPORT_RETENTION_DAYS`
- `AUDIT_RETENTION_DAYS`

PHI-bearing records should be purged once eligible unless a legal or clinical hold is active. Audit records should prefer anonymization so operational accountability can be retained without preserving direct PHI.
