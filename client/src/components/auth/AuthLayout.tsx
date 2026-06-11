import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-[480px]">
        {/* Branding Section */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Clinical Insight
          </h1>
          <p className="mt-2 text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 uppercase">
            Secure Clinical AI Portal
          </p>
        </div>

        {/* Content */}
        {children}

        {/* Footer / Development Notice */}
        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          <p>HIPAA Compliant Platform</p>
          {import.meta.env.DEV && (
            <div className="mt-4 opacity-50 hover:opacity-100 transition-opacity">
              <p className="font-mono text-[10px]">
                Development Environment: Check .env.local for seeded credentials
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
