interface Props {
  factors: { name: string }[];
}

const glossary: Record<string, string> = {
  hypertension: "Persistently elevated blood pressure.",
  bmi: "Body Mass Index, a measure of body weight relative to height.",
  "hba1c level":
    "A blood test showing average blood sugar over the past 2–3 months.",
  "blood glucose level":
    "The amount of glucose present in the bloodstream.",
  cholesterol: "A fatty substance found in the blood.",
  ldl: "Low-density lipoprotein, often called 'bad' cholesterol.",
  hdl: "High-density lipoprotein, often called 'good' cholesterol.",
  "heart disease": "A group of conditions affecting the heart.",
  "smoking history": "A record of current or past tobacco use.",
};

export function MedicalGlossary({ factors }: Props) {
  const terms = factors.filter(
    (factor) => glossary[factor.name.toLowerCase()]
  );

  if (terms.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold mb-4">
        Medical Glossary
      </h3>

      <div className="space-y-4">
        {terms.map((factor) => (
          <div key={factor.name}>
            <h4 className="font-semibold">{factor.name}</h4>
            <p className="text-sm text-muted-foreground">
              {glossary[factor.name.toLowerCase()]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}