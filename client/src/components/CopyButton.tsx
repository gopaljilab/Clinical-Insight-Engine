import { useCallback, useId, useState } from "react";
import { Copy, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopySuccessToast } from "@/components/CopySuccessToast";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  errorTitle?: string;
  className?: string;
  iconOnly?: boolean;
}

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  errorTitle = "Copy failed",
  className,
  iconOnly = true,
}: CopyButtonProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastId = useId();

  const handleCopy = useCallback(async () => {
    setError(null);
    setCopied(false);
    setIsCopying(true);

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard access is not supported in this browser.");
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to copy";
      setError(message);
    } finally {
      setIsCopying(false);
    }
  }, [text]);

  return (
    <>
      <Button
        type="button"
        onClick={() => void handleCopy()}
        disabled={isCopying || text.length === 0}
        aria-label={iconOnly ? `Copy${label ? `: ${label}` : ""}` : label}
        className={cn(
          "flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98]",
          iconOnly
            ? "w-9 h-9 p-0 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm shadow-sm"
            : "gap-2 px-4 py-2 text-sm font-semibold",
          className,
        )}
      >
        {isCopying ? (
          <span
            className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : copied ? (
          <Check className={cn(iconOnly ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
        ) : error ? (
          <X className={cn(iconOnly ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
        ) : (
          <Copy className={cn(iconOnly ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
        )}
        {!iconOnly && (isCopying ? "Copying..." : copied ? copiedLabel : label)}
      </Button>

      {copied && <CopySuccessToast title="Copied!" description="Code snippet copied to clipboard." />}

      {error && (
        <CopySuccessToast title={errorTitle} description={error} variant="destructive" />
      )}

      {/* keep toastId referenced to avoid React unused warning in some builds */}
      <span className="sr-only" aria-hidden="true">
        {toastId}
      </span>
    </>
  );
}

