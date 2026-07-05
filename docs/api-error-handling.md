# API Error Handling Standards

## Overview
This document outlines the standard error handling conventions across the Clinical Insight Engine API. In a clinical context, error messages must be descriptive enough for debugging but strictly sanitized to prevent leakage of PHI (Protected Health Information) or internal system architectures.

## HTTP Status Codes
We utilize standard HTTP status codes:
- **400 Bad Request:** Validation errors, missing required clinical metrics.
- **401 Unauthorized:** Invalid or missing authentication token.
- **403 Forbidden:** Valid authentication, but insufficient roles (e.g., trying to access another provider's patient).
- **404 Not Found:** Requested resource (patient, assessment) does not exist.
- **500 Internal Server Error:** Unhandled exceptions or ML model timeout.

## Structured JSON Error Format
All API errors return a standardized JSON structure.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The provided HbA1c level is out of the clinically acceptable bounds.",
    "details": [
      {
        "field": "hba1cLevel",
        "issue": "Value must be between 2.0 and 20.0"
      }
    ],
    "timestamp": "2026-06-16T12:00:00Z",
    "traceId": "req-1234abc"
  }
}
```

## Security Best Practices
> [!WARNING]
> Never include raw stack traces, database schema details, or raw unredacted patient inputs in the `message` or `details` arrays. Ensure errors are intercepted globally by the Express error handler middleware.