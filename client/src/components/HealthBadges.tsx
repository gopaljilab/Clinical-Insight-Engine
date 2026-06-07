import { type FC } from "react";
import { Activity, Award, HeartPulse, ShieldCheck, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { HealthBadge } from "@/utils/healthBadges";

const ICON_MAP: Record<HealthBadge["id"], typeof HeartPulse> = {
  "improved-bmi": HeartPulse,
  "reduced-hba1c": TrendingDown,
  "reduced-glucose": Activity,
  "lower-risk": ShieldCheck,
  "healthy-streak": Award,
};

const COLOR_MAP: Record<HealthBadge["id"], string> = {
  "improved-bmi": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "reduced-hba1c": "bg-sky-50 text-sky-700 border-sky-200",
  "reduced-glucose": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "lower-risk": "bg-lime-50 text-lime-700 border-lime-200",
  "healthy-streak": "bg-violet-50 text-violet-700 border-violet-200",
};

interface HealthBadgesProps {
  badges: HealthBadge[];
  title?: string;
  description?: string;
}

export const HealthBadges: FC<HealthBadgesProps> = ({
  badges,
  title = "Health improvement badges",
  description,
}) => {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
    <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] font-bold text-muted-foreground">
            Progress rewards
          </p>
          <h2 className="text-2xl font-black text-foreground">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground max-w-2xl">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
          Keep tracking patient assessments to start earning improvement badges. Badges appear when metrics or overall risk trend better compared to previous evaluations.
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 opacity-60 grayscale cursor-not-allowed">
          {[1, 2, 3].map((i) => (
            <div key={i} className="group rounded-3xl border border-dashed border-border bg-background/50 p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-muted bg-muted/20 text-muted-foreground">
                  <Activity className="h-5 w-5 opacity-50" />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted/40" />
                  <div className="h-3 w-full rounded bg-muted/30" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Badge variant="outline" className="uppercase tracking-[0.2em] text-[10px] text-muted-foreground">
                  Locked
                </Badge>
                <span className="text-[10px] text-muted-foreground">Needs more data</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {badges.map((badge) => {
              const Icon = ICON_MAP[badge.id] ?? Activity;
              const colorClass = COLOR_MAP[badge.id];
              return (
                <Tooltip key={badge.id}>
                  <TooltipTrigger asChild>
                    <div className="group rounded-3xl border border-border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-help">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${colorClass}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-foreground">{badge.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{badge.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="uppercase tracking-[0.2em] text-[10px]">
                          Earned
                        </Badge>
                        <span className="text-xs text-muted-foreground">Tap for details</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{badge.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
};

export default HealthBadges;
