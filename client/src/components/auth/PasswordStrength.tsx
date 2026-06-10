import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: "";
}

export function PasswordStrength({ password }: { password: string }) {
  const criteria = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      {criteria.map((criterion, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 transition-colors ${
            criterion.met ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {criterion.met ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{criterion.label}</span>
        </div>
      ))}
    </div>
  );
}
