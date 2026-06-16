# Prediction Metrics Architecture

## Risk Scoring System

The core predictive engine outputs a `riskScore` normalized from `0.0` to `100.0`. This score represents the relative probability of an adverse cardiometabolic event occurring within the next 5 years.

### Risk Categories
The numerical score maps to specific categories:
- **LOW:** `< 20.0` (Standard preventive screening recommended)
- **MODERATE:** `20.0 - 49.9` (Lifestyle intervention, monitor HbA1c annually)
- **HIGH:** `>= 50.0` (Aggressive intervention, pharmacological management consideration)

## Explainability Factors

To provide clinical transparency, every prediction includes an array of `factors`:
```typescript
interface RiskFactor {
  name: string; // e.g., "HbA1c Level"
  impact: "positive" | "negative"; // "positive" means increases risk, "negative" means protective
  strength: number; // 0-100 relative weight
  description: string; // Plain language clinical explanation
}
```

These factors drive the "Clinical Explainability Panel" in the Dashboard, ensuring the model acts as a "glass box" rather than a "black box" algorithm.