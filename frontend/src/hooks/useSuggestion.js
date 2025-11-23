import { useState, useCallback } from 'react';

export function useSuggestion(
  initialText,
  url,
  features,
  milestones,
  letterRef
) {
  const [suggestion, setSuggestion] = useState(initialText);

  const requestSuggestion = useCallback(
    async (clickedFeature) => {
      try {
        // Access the current value of the letter from the Ref
        const currentLetter = letterRef.current || '';

        const payload = {
          clickedFeature,
          features,
          milestones, // Send Milestones
          letter: currentLetter, // Send Letter
        };

        const res = await fetch(`${url}/generate_suggestion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        if (data.suggestion) setSuggestion(data.suggestion);
      } catch (err) {
        console.error('Suggestion fetch failed', err);
      }
    },
    // We add milestones and letterRef to dependencies.
    // Note: refs don't trigger re-renders, but we need it in the dependency array or closure.
    [features, url, milestones, letterRef]
  );

  return [suggestion, requestSuggestion];
}
