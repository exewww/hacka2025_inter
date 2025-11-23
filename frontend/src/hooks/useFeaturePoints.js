import { useState, useCallback, useRef, useEffect } from "react";

// Added onFeaturesUpdated parameter
export function useFeaturePoints(initialValues, backendUrl, onFeaturesUpdated, debounceTime = 2000) {
  const [features, setFeatures] = useState(initialValues);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const previousRef = useRef(initialValues);

  const updateBackend = useCallback(
    async (newFeatures) => {
      const prevSnapshot = previousRef.current;
      const payload = {};
      
      for (const key of Object.keys(newFeatures)) {
        payload[key] = {
          value: newFeatures[key].value,
          enabled: newFeatures[key].enabled,
          previous_value: prevSnapshot[key]?.value ?? newFeatures[key].value,
        };
      }

      console.log("🚀 Sending payload to backend:", payload);

      try {
        const response = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ features: payload }),
        });

        const data = await response.json();

        if (data.features) {
          setFeatures((prevLocal) => {
            const merged = {};
            for (const key of Object.keys(prevLocal)) {
              merged[key] = {
                ...prevLocal[key],
                value: data.features[key]?.value ?? prevLocal[key].value,
                enabled: prevLocal[key].enabled,
              };
            }
            
            previousRef.current = merged;
            
            // --- NEW: Trigger the external callback (Generate Milestones) ---
            if (onFeaturesUpdated) {
               onFeaturesUpdated(merged);
            }
            
            return merged;
          });
        }

        setProgress(0);
      } catch (err) {
        console.error("Backend update failed:", err);
        setProgress(0);
      }
    },
    [backendUrl, onFeaturesUpdated] // Added onFeaturesUpdated to dependencies
  );

  const startDebounce = useCallback(
    (updatedState) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);

      setProgress(0);
      let elapsed = 0;

      progressRef.current = setInterval(() => {
        elapsed += 100;
        setProgress(Math.min(100, (elapsed / debounceTime) * 100));
      }, 100);

      timerRef.current = setTimeout(() => {
        updateBackend(updatedState);
        clearInterval(progressRef.current);
        progressRef.current = null;
        timerRef.current = null;
        setProgress(0);
      }, debounceTime);
    },
    [debounceTime, updateBackend]
  );

  const updateFeatureValue = useCallback(
    (name, value) => {
      setFeatures((prev) => {
        const next = { ...prev, [name]: { ...prev[name], value } };
        startDebounce(next);
        return next;
      });
    },
    [startDebounce]
  );

  const toggleFeatureEnabled = useCallback((name) => {
    setFeatures((prev) => ({
      ...prev,
      [name]: { ...prev[name], enabled: !prev[name].enabled },
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  return { features, updateFeatureValue, toggleFeatureEnabled, progress };
}