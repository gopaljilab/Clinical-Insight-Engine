**Is your feature request related to a problem? Please describe.**
I'm always frustrated when a batch CSV import contains erroneous data (e.g., an age of 900 or a BMI of 5) due to typos. The system currently accepts this data if it matches the schema types, which completely skews the ML risk prediction and ruins the risk trend charts.

**Describe the solution you'd like**
I want an automated anomaly detection system during data ingestion that catches physically impossible or statistically improbable values. Instead of rejecting the entire batch or accepting bad data, these anomalous records should be placed in a "Quarantine Queue" UI where clinicians can review, fix, or discard them.

**Describe alternatives you've considered**
I considered adding manual reviews for every import, but that's too time-consuming. Alternatively, simply dropping invalid rows silently means we lose track of data entry issues and potentially miss important records.

**Additional context**
Resolves #2384. This PR introduces a `quarantined_assessments` table to store data that failed validation. It updates the `/api/upload/csv` logic to intercept Zod schema validation errors, inserting problematic rows into the quarantine queue instead of ignoring them. It also introduces a new `QuarantineQueue.tsx` UI page to review and resolve the flagged rows.
