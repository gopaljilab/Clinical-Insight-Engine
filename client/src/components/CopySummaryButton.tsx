import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentSummaryFormatter } from "@/components/AssessmentSummaryFormatter";
import { CopySuccessToast } from "@/components/CopySuccessToast";
import type { AssessmentResponse } from "@shared/routes";

interface CopySummaryButtonProps {
  assessment: AssessmentResponse;
  iconOnly?: boolean;
}

export function CopySummaryButton({ assessment, iconOnly = false }: CopySummaryButtonProps) {
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
            aria-label="Copy assessment summary to clipboard"
            className={`flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] ${
              iconOnly 
                ? "w-9 h-9 p-0 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm shadow-sm" 
                : "gap-2 px-4 py-2 text-sm font-semibold"
            }`}
          >
            {isCopying ? (
              <LoaderPlaceholder />
            ) : copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {!iconOnly && (isCopying ? "Copying..." : copied ? "Copied" : "Copy Summary")}
          </Button>
          {copied && <CopySuccessToast />}
          {copyError && (
            <CopySuccessToast
              title="Copy failed"
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
