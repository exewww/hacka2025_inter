import { useState, useEffect } from 'react';

export function useInitialFeatures(backendUrl) {
  // Hard-coded fallback values
  const fallbackFeatures = {
    RiskTolerance: { value: 0.4, enabled: true },
    ExpectedAnnualReturn: { value: 0.5, enabled: false },
    MinApartmentSize: { value: 0.6, enabled: true },
    Centrality: { value: 0.8, enabled: true },
    YearsToPurchase: { value: 0.3, enabled: true },
    InitialCapital: { value: 0.2, enabled: true },
    MonthlySavings: { value: 0.5, enabled: true },
    MortgageInterestRate: { value: 0.4, enabled: true },
    MortgageDuration: { value: 0.7, enabled: true },
  };

  // State
  const [features, setFeatures] = useState(fallbackFeatures);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only called once on mount
  useEffect(() => {
    let called = false; // ensure only one fetch

    async function fetchInitialFeatures() {
      if (called) return;
      called = true;

      try {
        const response = await fetch(`${backendUrl}/initial_features`);
        if (!response.ok) throw new Error('Failed to load initial features');

        const data = await response.json();
        if (data.features) {
          setFeatures(data.features);
          console.log('Fetched initial features:', data.features);
        }
      } catch (err) {
        console.error('Error loading initial features:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialFeatures();
  }, [backendUrl]);

  return { features, loading, error };
}
