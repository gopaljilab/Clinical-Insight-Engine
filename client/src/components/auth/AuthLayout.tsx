import { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { ShieldCheck, Brain, TrendingUp, Users, Zap } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Risk Assessment",
    description: "Predict patient diabetes risk with explainable ML models trained on clinical data.",
  },
  {
    icon: TrendingUp,
    title: "Longitudinal Patient Monitoring",
    description: "Track patient health trends over time with interactive dashboards and alerts.",
  },
  {
    icon: Users,
    title: "Preventive Care Analytics",
    description: "Identify at-risk populations early and prioritise preventive interventions.",
  },
  {
    icon: Zap,
    title: "Explainable Clinical Insights",
    description: "Every prediction comes with transparent factor analysis clinicians can trust.",
  },
];

const COMPLIANCE_BADGES = [
  { label: "HIPAA Compliant" },
  { label: "SOC 2" },
  { label: "GDPR" },
  { label: "256-bit Encryption" },
];

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — product storytelling ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-600 to-teal-500 px-12 py-12 text-white">
        {/* Logo */}
        <div>
          <Logo variant="full" size="lg" className="brightness-0 invert" />
        </div>

        {/* Headline */}
        <div className="space-y-10">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Clinical Intelligence<br />for Modern Healthcare
            </h1>
            <p className="mt-4 text-lg text-blue-100 leading-relaxed max-w-md">
              AI-assisted risk assessment and preventive care analytics — built for clinicians who demand transparency and precision.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Icon className="h-4.5 w-4.5 text-white" size={18} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-blue-100 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance badges */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
            Enterprise Security &amp; Compliance
          </p>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_BADGES.map(({ label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/20"
              >
                <ShieldCheck className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — auth form ── */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-8">
        <div className="w-full max-w-[480px]">
          {/* Mobile logo — hidden on desktop where left panel shows it */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo variant="full" size="lg" />
          </div>

          {/* Form content */}
          {children}

          {/* Mobile compliance badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:hidden">
            {COMPLIANCE_BADGES.map(({ label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>

          {import.meta.env.DEV && (
            <div className="mt-4 text-center opacity-50 hover:opacity-100 transition-opacity">
              <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                Development Environment: Check .env.local for seeded credentials
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
