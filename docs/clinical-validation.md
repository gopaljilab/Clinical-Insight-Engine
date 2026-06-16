# Clinical Validation Guidelines

## Model Performance & Sensitivity

The Predictive Diabetes & Cardiovascular Risk model must undergo regular clinical validation to ensure real-world efficacy.

### Core Metrics Target
- **Sensitivity (Recall):** > 85% (Crucial for preventing false negatives in high-risk patients)
- **Specificity:** > 75%
- **AUROC:** > 0.82

## Evaluation Protocols
1. **Retrospective Cohort Testing:** The model is tested against anonymized historical datasets to verify its predictive power over a 5-year horizon.
2. **Sub-population Fairness:** Predictions must be validated across varying demographics (age buckets, gender) to ensure there is no statistical bias penalizing specific cohorts.

## Documentation of Heuristics
If the primary ML model is unavailable, the system falls back to a deterministic heuristic. This rule-based fallback utilizes standard clinical thresholds (e.g., BMI > 30 AND HbA1c > 6.5 = High Risk). All fallback events must be flagged in the UI so the clinician is aware.

> [!CAUTION]
> This tool provides clinical decision support. It does not replace clinical judgment or diagnosis.