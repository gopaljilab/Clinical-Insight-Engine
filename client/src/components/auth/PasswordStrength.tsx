import { Check, X } from "lucide-react";

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 5) return { score, label: "Strong", color: "bg-yellow-500" };
  return { score, label: "Very Strong", color: "bg-green-500" };
}

export function PasswordStrength({ password }: { password: string }) {
  const criteria = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const strength = getStrength(password);
  const allMet = criteria.every((c) => c.met);

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${(strength.score / 6) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${allMet ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
          {password.length > 0 ? strength.label : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
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
    </div>
  );
}
