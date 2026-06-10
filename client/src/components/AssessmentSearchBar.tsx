import { useState, useEffect, useRef } from "react";
import { Search, X, ShieldAlert, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { validateSearchInput } from "@/validation/filterValidation";

interface AssessmentSearchBarProps {
  value: string;
  onSearch: (value: string) => void;
  onClear: () => void;
}

export function AssessmentSearchBar({ value, onSearch, onClear }: AssessmentSearchBarProps) {
  const [rejected, setRejected] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/assessments/autocomplete?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (raw: string) => {
    const safe = validateSearchInput(raw, () => {
      setRejected(true);
      window.setTimeout(() => setRejected(false), 3000);
    });

    onSearch(safe);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(safe), 300);
  };

  const selectSuggestion = (name: string) => {
    onSearch(name);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    onClear();
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-2 relative" ref={wrapperRef}>
      <label className="sr-only" htmlFor="assessment-search">
        Search assessments
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="assessment-search"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder="Search by patient name..."
          className="pl-10 pr-10"
          aria-invalid={rejected}
          aria-describedby={rejected ? "assessment-search-warning" : undefined}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
        )}
        {value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((name) => (
            <li
              key={name}
              onClick={() => selectSuggestion(name)}
              className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors border-b border-border last:border-b-0"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
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
