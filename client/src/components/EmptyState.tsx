import React from "react";
import { LucideIcon } from "lucide-react";
import { Link } from "wouter";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  secondaryActionOnClick?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  actionOnClick,
  secondaryActionLabel,
  secondaryActionHref,
  secondaryActionOnClick,
}: EmptyStateProps) {
  const primaryAction = actionLabel && (actionHref || actionOnClick);
  const secondaryAction =
    secondaryActionLabel && (secondaryActionHref || secondaryActionOnClick);

  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-6">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 mb-8 max-w-md mx-auto">{description}</p>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          {actionLabel && actionHref && (
            <Link href={actionHref}>
              <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                {actionLabel}
              </a>
            </Link>
          )}

          {actionLabel && actionOnClick && (
            <button
              type="button"
              onClick={actionOnClick}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {actionLabel}
            </button>
          )}

          {secondaryActionLabel && secondaryActionHref && (
            <Link href={secondaryActionHref}>
              <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                {secondaryActionLabel}
              </a>
            </Link>
          )}

          {secondaryActionLabel && secondaryActionOnClick && (
            <button
              type="button"
              onClick={secondaryActionOnClick}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
