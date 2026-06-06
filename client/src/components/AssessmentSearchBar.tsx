import { useState } from "react";
import { Search, X, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validateSearchInput } from "@/validation/filterValidation";

interface AssessmentSearchBarProps {
  value: string;
  onSearch: (value: string) => void;
  onClear: () => void;
}

export function AssessmentSearchBar({ value, onSearch, onClear }: AssessmentSearchBarProps) {
  const [rejected, setRejected] = useState(false);

  const handleChange = (raw: string) => {
    const safe = validateSearchInput(raw, () => {
      setRejected(true);
      window.setTimeout(() => setRejected(false), 3000);
    });

    onSearch(safe);
  };

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="assessment-search">
        Search assessments
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="assessment-search"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="Search history..."
          className="pl-10 pr-10"
          aria-invalid={rejected}
          aria-describedby={rejected ? "assessment-search-warning" : undefined}
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {rejected && (
        <div
          id="assessment-search-warning"
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <ShieldAlert className="h-4 w-4" />
          Invalid search value detected.
        </div>
      )}
    </div>
  );
}
