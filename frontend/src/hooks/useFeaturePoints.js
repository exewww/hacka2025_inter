import { useState, useCallback, useRef, useEffect } from "react";

/**
 * initialValues: { featureName: { value: 0..1, enabled: boolean } }
 * backendUrl: backend endpoint for generating new values
 */
export function useFeaturePoints(initialValues, backendUrl, debounceTime = 5000) {
  const [features, setFeatures] = useState(initialValues);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  // Call backend
  const updateBackend = useCallback(async (featuresToSend) => {
    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: featuresToSend }),
      });
      const data = await response.json();
      if (data.features) {
        // Merge backend values with local enabled flags
        setFeatures(prev => {
          const merged = {};
          for (const key of Object.keys(prev)) {
            merged[key] = {
              value: data.features[key]?.value ?? prev[key].value,
              enabled: prev[key].enabled // keep local lock state
            };
          }
          return merged;
        });
      }
      setProgress(0);
    } catch (err) {
      console.error("Backend update failed:", err);
    }
  }, [backendUrl]);

  // Debounce logic
const startDebounce = useCallback(() => {
  if (timerRef.current) clearTimeout(timerRef.current);
  if (progressRef.current) clearInterval(progressRef.current);

  setProgress(0);
  let elapsed = 0;

  progressRef.current = setInterval(() => {
    elapsed += 100;
    setProgress(Math.min(100, (elapsed / debounceTime) * 100));
  }, 100);

  timerRef.current = setTimeout(() => {
    setFeatures(prevFeatures => {
      const featuresToSend = {};
      for (const key in prevFeatures) {
        featuresToSend[key] = {
          value: prevFeatures[key].value,
          enabled: prevFeatures[key].enabled
        };
      }

      updateBackend(featuresToSend);
      return prevFeatures; // don't change state here
    });

    clearInterval(progressRef.current);
    progressRef.current = null;
    timerRef.current = null;
    setProgress(0);
  }, debounceTime);
}, [debounceTime, updateBackend]);

  // Update value → triggers backend
  const updateFeatureValue = useCallback(
    (featureName, value) => {
      setFeatures(prev => {
        const next = { ...prev, [featureName]: { ...prev[featureName], value } };
        startDebounce(next);
        return next;
      });
    },
    [startDebounce]
  );

  // Toggle enabled → frontend only
  const toggleFeatureEnabled = useCallback(
    (featureName) => {
      setFeatures(prev => ({
        ...prev,
        [featureName]: { ...prev[featureName], enabled: !prev[featureName].enabled }
      }));
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  return { features, updateFeatureValue, toggleFeatureEnabled, progress };
}
