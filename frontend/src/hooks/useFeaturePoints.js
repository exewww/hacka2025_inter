import { useState, useCallback, useRef, useEffect } from "react";

export function useFeaturePoints(initialValues, backendUrl, debounceTime = 5000) {
  const [features, setFeatures] = useState(initialValues);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const previousRef = useRef(initialValues); // <-- store last version for diff

  // Compare previous and current → returns list of changed feature names
  const getChangedFeatures = (prev, curr) => {
    const changed = [];
    for (const key of Object.keys(curr)) {
      if (prev[key].value !== curr[key].value || prev[key].enabled !== curr[key].enabled) {
        changed.push(key);
      }
    }
    return changed;
  };

  // Backend call
  const updateBackend = useCallback(
    async (newFeatures) => {
      const prev = previousRef.current;
      const changedKeys = getChangedFeatures(prev, newFeatures);

      // Build payload:
      // - send all features
      // - BUT for changed ones → set enabled=false ONLY IN PAYLOAD
      const payload = {};
      for (const key of Object.keys(newFeatures)) {
        const wasChanged = changedKeys.includes(key);
        payload[key] = {
          value: newFeatures[key].value,
          enabled: wasChanged ? false : newFeatures[key].enabled,
        };
      }

      try {
        const response = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ features: payload }),
        });

        const data = await response.json();

        if (data.features) {
          // merge backend values but keep local enabled flags
          setFeatures((prevLocal) => {
            const merged = {};
            for (const key of Object.keys(prevLocal)) {
              merged[key] = {
                value: data.features[key]?.value ?? prevLocal[key].value,
                enabled: prevLocal[key].enabled, // don't touch the UI lock status
              };
            }
            return merged;
          });

          // Update previous snapshot AFTER backend accepted it
          previousRef.current = newFeatures;
        }

        setProgress(0);
      } catch (err) {
        console.error("Backend update failed:", err);
      }
    },
    [backendUrl]
  );

  // Debounce
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

  // Updating a feature value triggers debounce
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

  // Only local UI toggle
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
