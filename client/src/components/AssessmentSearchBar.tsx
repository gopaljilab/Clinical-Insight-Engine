import { useState, useEffect, useRef } from "react";
import { Search, X, ShieldAlert, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { validateSearchInput } from "@/validation/filterValidation";
import { ApiClient } from "@/lib/apiClient";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = "assessment-search-list";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
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
      const data = await ApiClient.get<string[]>(`/api/assessments/autocomplete?q=${encodeURIComponent(query)}`);
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (raw: string) => {
    setActiveIndex(-1);
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
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onClear();
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Escape") {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
      case " ":
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setActiveIndex(-1);
        break;
    }
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
          ref={inputRef}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder="Search by patient name..."
          className="pl-10 pr-10"
          role="combobox"
          aria-expanded={showDropdown && suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
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
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto"
        >
          {suggestions.map((name, index) => (
            <li
              key={name}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => selectSuggestion(name)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors border-b border-border last:border-b-0 ${
                index === activeIndex ? "bg-muted" : "text-foreground"
              }`}
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
