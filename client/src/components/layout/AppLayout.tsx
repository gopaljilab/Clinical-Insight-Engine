import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Activity, ClipboardList, HeartPulse, LogOut, Loader2, PieChart, UploadCloud } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ThemeToggle from "../ThemeToggle";
import { useToast } from "@/hooks/use-toast";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) { setLocation("/"); return undefined; }
        if (!res.ok) { setNetworkError(true); return undefined; }
        return res.json();
      })
      .then((data) => { if (data) setUser(data.user); })
      .catch(() => setNetworkError(true))
      .finally(() => setChecking(false));
  }, [setLocation]);

  useEffect(() => {
    if (!user) return;

    let warningTimeoutId: number;
    let logoutTimeoutId: number;
    const WARNING_TIMEOUT = 14 * 60 * 1000; // 14 minutes
    const LOGOUT_TIMEOUT = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      window.clearTimeout(warningTimeoutId);
      window.clearTimeout(logoutTimeoutId);
      
      warningTimeoutId = window.setTimeout(() => {
        toast({
          title: "Session Expiring Soon",
          description: "You have been inactive. For your security, you will be logged out in 1 minute if inactivity continues.",
          variant: "destructive",
        });
      }, WARNING_TIMEOUT);

      logoutTimeoutId = window.setTimeout(() => {
        fetch("/api/auth/logout", { method: "POST", credentials: "include" })
          .finally(() => {
            queryClient.clear();
            setLocation("/");
          });
      }, LOGOUT_TIMEOUT);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      window.clearTimeout(warningTimeoutId);
      window.clearTimeout(logoutTimeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, toast]);

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      queryClient.clear();
    } finally {
      setIsSigningOut(false);
      setLocation("/");
    }
  };

  const navItems = [
    { href: "/dashboard", label: "New Assessment", icon: Activity },
    { href: "/history", label: "Patient History", icon: ClipboardList },
    { href: "/analytics", label: "Provider Analytics", icon: PieChart },
    { href: "/import", label: "Bulk Import CSV", icon: UploadCloud },
  ];

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl border border-slate-200 bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm max-w-md">
          <p className="text-lg font-bold text-slate-800 dark:text-white">Connection error</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Unable to verify your session. Please check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 flex flex-col md:flex-row transition-colors duration-300">
      {/* Sidebar */}
      <aside className="print:hidden w-full md:w-64 lg:w-72 bg-white dark:bg-gray-900 border-r border-slate-100 dark:border-gray-800 flex shrink-0 md:h-screen sticky top-0 z-10 shadow-sm shadow-slate-900/[0.02] dark:shadow-gray-950/50 transition-colors duration-300">
        <div className="flex h-full w-full flex-col justify-between">
          <div>
            <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-gray-800">
              <Link
                href="/dashboard"
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/15 hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Go to main dashboard"
                title="Go to main dashboard"
              >
                <HeartPulse className="w-6 h-6" />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 bg-emerald-400" />
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-black leading-tight text-[#1E293B] dark:text-gray-100 truncate">Clinical Insight</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Preventive Risk Tool</p>
              </div>
              <ThemeToggle />
            </div>

            <nav className="p-4 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 shadow-md shadow-blue-500/10 dark:shadow-blue-400/10"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-[#1E293B] dark:hover:text-gray-200"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="m-4 border-t border-slate-100 dark:border-gray-800 pt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-gray-800 p-3">
              <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-700 flex items-center justify-center text-blue-700 dark:text-blue-400 font-black text-sm border border-slate-100 dark:border-gray-600 shadow-sm">
                {user?.name?.charAt(0) || "Dr"}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-black text-[#1E293B] dark:text-gray-100 leading-tight truncate">{user?.name || "Clinician"}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate">{user?.email || "clinical@insight-engine.dev"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Sign out of Clinical Insight workspace"
              title="Sign out"
            >
              {isSigningOut ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="w-4 h-4" aria-hidden="true" />
              )}
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </button>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
              Local workspace secured with simulated 2FA
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto transition-colors duration-300">
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}

