# Logging and PII Redaction

## Regulatory Requirements

To maintain HIPAA/GDPR compliance, Protected Health Information (PHI) and Personally Identifiable Information (PII) must never be written to plaintext logs.

## Redaction Strategy

Our logging utility (Winston/Pino) is configured to automatically scrub sensitive keys from JSON payloads before writing to standard out.

### Scrubbed Fields
- `patientName`
- `email`
- `socialSecurityNumber`
- `address`

### Log Formatting Example
```json
// Incoming request payload
{ "patientName": "John Doe", "age": 45, "bmi": 28.5 }

// Safe log output
{ "patientName": "[REDACTED]", "age": 45, "bmi": 28.5 }
```

> [!CAUTION]
> If you add new PII fields to the `schema.ts` definition, you MUST add the field name to the redaction dictionary in the logging middleware.
