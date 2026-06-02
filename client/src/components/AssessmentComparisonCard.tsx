interface Props {
  assessments: any[];
}

export default function AssessmentComparisonCard({
  assessments,
}: Props) {
  if (!assessments || assessments.length < 2) return null;

  const sorted = [...assessments].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt).getTime()
  );

  const current = sorted[0];
  const previous = sorted[1];

  const currentRisk = Number(current.riskScore);
  const previousRisk = Number(previous.riskScore);

  const diff = currentRisk - previousRisk;

  const status =
    diff < 0
      ? {
          badge: (
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              Improving
            </div>
          ),
          trend: `↓ Improved by ${Math.abs(diff).toFixed(1)}%`,
          message:
            "Great progress! Your risk score has improved.",
        }
      : diff > 0
      ? {
          badge: (
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">
              🔴 Increased Risk
            </div>
          ),
          trend: `↑ Increased by ${diff.toFixed(1)}%`,
          message:
            "Risk has increased since the previous assessment.",
        }
      : {
          badge: (
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
              🟡 Stable
            </div>
          ),
          trend: "→ No Change",
          message: "Your risk remains stable.",
        };

  return (
    <div className="mb-6 rounded-xl border p-6 bg-card">
      <h2 className="text-xl font-bold mb-4">
        📈 Risk Progress
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <p>Previous Risk: {previousRisk}%</p>
        <p>Current Risk: {currentRisk}%</p>
        <p className="font-semibold">{status.trend}</p>
      </div>

      <div className="mt-3 inline-block rounded-full px-3 py-1 border">
        {status.badge}
      </div>

      <p className="mt-4 text-muted-foreground">
        {status.message}
      </p>
    </div>
  );
}