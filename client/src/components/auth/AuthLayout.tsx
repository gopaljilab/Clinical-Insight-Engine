import { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { ShieldCheck } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-[480px]">
        {/* Branding Section */}
        <div className="mb-8 flex justify-center">
          <Logo variant="full" size="lg" />
        </div>

        {/* Content */}
        {children}

        {/* Trust Footer */}
        <div className="mt-8 space-y-3 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              HIPAA Compliant
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              SOC 2
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              GDPR
            </span>
          </div>
          {import.meta.env.DEV && (
            <div className="opacity-50 hover:opacity-100 transition-opacity">
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
