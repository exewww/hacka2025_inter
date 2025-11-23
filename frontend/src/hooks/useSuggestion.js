// useSuggestion.js
import { useState, useCallback } from "react";
export function useSuggestion(initialText, url, features) {
  const [suggestion, setSuggestion] = useState(initialText);

  const requestSuggestion = useCallback(
    async (clickedFeature) => {
      try {
        const payload = { clickedFeature, features };

        const res = await fetch(`${url}/generate_suggestion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        if (data.suggestion) setSuggestion(data.suggestion);
      } catch (err) {
        console.error("Suggestion fetch failed", err);
      }
    },
    [features, url]
  );

  return [suggestion, requestSuggestion];
}
