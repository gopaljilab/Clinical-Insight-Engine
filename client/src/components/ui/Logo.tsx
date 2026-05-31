import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "icon" | "text";
  theme?: "light" | "dark" | "auto";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: "text-sm", tagline: "text-xs" },
  md: { icon: 32, text: "text-base", tagline: "text-xs" },
  lg: { icon: 40, text: "text-xl", tagline: "text-sm" },
};

export function Logo({ variant = "full", theme = "auto", size = "md", className }: LogoProps) {
  const s = sizes[size];
  const textColor = theme === "dark" ? "text-white" : theme === "light" ? "text-[#1E293B]" : "text-foreground";
  const subColor = theme === "dark" ? "text-slate-400" : theme === "light" ? "text-[#64748B]" : "text-muted-foreground";

  const Icon = () => (
    <svg width={s.icon} height={s.icon} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill="#2563EB" fillOpacity="0.1"/>
      <circle cx="24" cy="24" r="22" stroke="#2563EB" strokeWidth="1.5"/>
      <polyline
        points="4,24 10,24 13,12 17,36 21,16 24,28 27,18 31,24 38,24 40,19 42,29 44,24"
        stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <rect x="33" y="19" width="3.5" height="10" fill="#06B6D4" rx="1"/>
      <rect x="37.5" y="15" width="3.5" height="14" fill="#2563EB" rx="1"/>
      <rect x="42" y="21" width="3.5" height="8" fill="#10B981" rx="1"/>
    </svg>
  );

  if (variant === "icon") return <Icon />;

  if (variant === "text") return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("font-bold leading-tight", s.text, textColor)}>
        Clinical Insight Engine
      </span>
      <span className={cn("leading-tight", s.tagline, subColor)}>
        AI-Powered Preventive Care
      </span>
    </div>
  );

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Icon />
      <div className="flex flex-col">
        <span className={cn("font-bold leading-tight", s.text, textColor)}>
          Clinical Insight Engine
        </span>
        <span className={cn("leading-tight", s.tagline, subColor)}>
          AI-Powered Preventive Care
        </span>
      </div>
    </div>
  );
}

export default Logo;
