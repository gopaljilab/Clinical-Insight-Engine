import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

const languages = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "hi", label: "HI" },
];

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "minimal" }) {
  const { i18n, t } = useTranslation();

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  if (variant === "minimal") {
    return (
      <select
        value={i18n.language?.split("-")[0] || "en"}
        onChange={(e) => handleChange(e.target.value)}
        className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        aria-label={t("language.switchTo")}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Languages className="w-4 h-4 text-slate-400" aria-hidden="true" />
      <div className="flex gap-1">
        {languages.map((lang) => {
          const isActive = (i18n.language?.split("-")[0] || "en") === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`text-xs font-bold px-2 py-1 rounded-md transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
              aria-label={`${t("language.switchTo")} - ${t(`language.${lang.code}`)}`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
