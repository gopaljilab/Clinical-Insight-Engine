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
    { href: "/", label: "New Assessment", icon: Activity },
    { href: "/history", label: "Patient History", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 lg:w-72 bg-card border-r border-border flex flex-col shrink-0 md:h-screen sticky top-0 z-10">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">CardioGuard</h1>
            <p className="text-xs text-muted-foreground font-medium">Preventive Risk Tool</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-sm border border-border">
              Dr
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground leading-tight">Dr. Smith</span>
              <span className="text-xs text-muted-foreground">Cardiology</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
