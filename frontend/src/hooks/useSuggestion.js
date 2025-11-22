import { useState, useEffect } from "react";

export function useSuggestion(initialValue = "suggestion here", url, features) {
  const [suggestion, setSuggestion] = useState(initialValue);

  useEffect(() => {
    // Call backend whenever features change
    async function fetchSuggestion() {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(features)
        });
        const data = await response.json();
        // Assume backend returns { suggestion: "..." }
        setSuggestion(data.suggestion || initialValue);
      } catch (err) {
        console.error(err);
      }
    }

    fetchSuggestion();
  }, [features, url, initialValue]);

  return [suggestion, setSuggestion];
}
