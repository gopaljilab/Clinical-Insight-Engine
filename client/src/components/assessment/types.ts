export interface RiskFactor {
  name: string;
  impact: "positive" | "negative" | string;
  description: string;
}

export interface FactorBreakdown extends RiskFactor {
  strength: number;
  plainReason: string;
}
