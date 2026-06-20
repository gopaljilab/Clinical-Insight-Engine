import React, { useState, useEffect } from 'react';
import { ApiClient } from '../utils/api-client'; // Using the central configured API utility

/**
 * Assessment Search Bar component featuring real-time autocomplete suggestions.
 * Fixed to route requests through ApiClient, enabling robust multi-origin capabilities.
 */
export const AssessmentSearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        // ApiClient prefixes VITE_API_BASE and handles credentials/headers for cross-origin setups
        const response = await ApiClient.get<{ success: boolean; data: string[] }>(
          `/assessments/autocomplete?q=${encodeURIComponent(query)}`
        );

        if (response.data && response.data.success) {
          setSuggestions(response.data.data);
        }
      } catch (err: any) {
        console.error('Failed to fetch autocomplete suggestions:', err.message);
      }
    }, 300); // 300ms debounce interval

    return () => clearTimeout(delayDebounce);
  }, [query]);

  return (
    <div className="search-bar-container">
      <input
        type="text"
        placeholder="Search clinical assessments..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input"
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-dropdown">
          {suggestions.map((item, idx) => (
            <li key={idx} className="suggestion-item">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AssessmentSearchBar;
