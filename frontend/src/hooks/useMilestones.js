import { useState, useCallback } from 'react';

export function useMilestones(backendUrl) {
  const [milestones, setMilestones] = useState([]);
  const [isLoadingMilestones, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMilestones = useCallback(
    async (letter, features) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${backendUrl}/generate_milestones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            letter: letter,
            features: features,
          }),
        });

        if (!response.ok) throw new Error('Failed to fetch milestones');

        const data = await response.json();

        if (data.milestones) {
          setMilestones(data.milestones);
          console.log('Fetched milestones:', data.milestones);
        }
      } catch (err) {
        console.error('Error fetching milestones:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [backendUrl]
  );

  return {
    milestones,
    setMilestones, // <--- ✅ ADDED THIS: Allows Dashboard to update state from Polling
    fetchMilestones,
    isLoadingMilestones,
    error,
  };
}
