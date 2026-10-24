import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentSummaryFormatter } from "@/components/AssessmentSummaryFormatter";
import { CopySuccessToast } from "@/components/CopySuccessToast";
import type { AssessmentResponse } from "@shared/routes";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface CopySummaryButtonProps {
  assessment: AssessmentResponse;
  iconOnly?: boolean;
  label?: string;
  copyingLabel?: string;
  copiedLabel?: string;
  ariaLabel?: string;
}

export function CopySummaryButton({
  assessment,
  iconOnly = false,
  label = "Copy Summary",
  copyingLabel = "Copying...",
  copiedLabel = "Copied",
  ariaLabel = "Copy assessment summary to clipboard",
}: CopySummaryButtonProps) {
  const { t } = useTranslation();
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (formattedSummary: string) => {
    setCopyError(null);
    setCopied(false);
    setIsCopying(true);

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard access is not supported in this browser.");
      }
      await navigator.clipboard.writeText(formattedSummary);
      setCopied(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? (error as Error).message
          : "Failed to copy summary. Please try again.";
      setCopyError(message);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <AssessmentSummaryFormatter assessment={assessment}>
      {(summary) => (
        <>
          <Button
            type="button"
            onClick={() => void handleCopy(summary)}
            disabled={isCopying}
            aria-label={ariaLabel}
            title={iconOnly ? ariaLabel : undefined}
            className={cn(
              "flex items-center justify-center rounded-lg transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              iconOnly 
                ? "h-10 w-10 shrink-0 border border-border bg-background p-0 text-foreground hover:bg-muted"
                : "min-h-10 max-w-full min-w-0 gap-2 border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            )}
          >
            {isCopying ? (
              <LoaderPlaceholder />
            ) : copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {!iconOnly && (isCopying ? copyingLabel : copied ? copiedLabel : label)}
          </Button>
          {copied && <CopySuccessToast title={t("patientResult.copied")} description={t("patientResult.copySuccessDescription")} />}
          {copyError && (
            <CopySuccessToast
              title={t("patientResult.copyFailed")}
              description={copyError}
              variant="destructive"
            />
          )}
        </>
      )}
    </AssessmentSummaryFormatter>
  );
}

function LoaderPlaceholder() {
  return (
    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
