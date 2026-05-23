import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, ClipboardList, HeartPulse } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "New Assessment", icon: Activity },
    { href: "/history", label: "Patient History", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 lg:w-72 bg-white border-r border-slate-100 flex shrink-0 md:h-screen sticky top-0 z-10 shadow-sm shadow-slate-900/[0.02]">
        <div className="flex h-full w-full flex-col justify-between">
          <div>
            <div className="p-6 flex items-center gap-3 border-b border-slate-100">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/15">
                <HeartPulse className="w-6 h-6" />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-black leading-tight text-[#1E293B]">CardioGuard</h1>
                <p className="text-xs text-slate-500 font-semibold">Preventive Risk Tool</p>
              </div>
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
                        ? "bg-blue-50 text-blue-700 shadow-md shadow-blue-500/10" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-[#1E293B]"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="m-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-blue-700 font-black text-sm border border-slate-100 shadow-sm">
                Dr
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-black text-[#1E293B] leading-tight">Dr. Smith</span>
                <span className="text-xs text-slate-500 font-semibold">Cardiology</span>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-slate-400">
              Local workspace secured with simulated 2FA.
            </p>
          </div> 
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
