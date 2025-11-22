import React from "react";
import InteractiveLineChart from "./components/InteractiveLineChart";
import { useFeaturePoints } from "./hooks/useFeaturePoints";

function App() {
  const initialFeatures = {
    Feature1: { value: 0.6, enabled: true },
    Feature2: { value: 0.4, enabled: false },
    Feature3: { value: 0.7, enabled: false },
    Feature4: { value: 0.2, enabled: false },
    Feature5: { value: 0.5, enabled: true },
    Feature6: { value: 0.8, enabled: true },
  };

  const { features, updateFeatureValue, toggleFeatureEnabled, progress } =
    useFeaturePoints(initialFeatures, "http://localhost:5000/generate");

  return (
    <div style={{ padding: "40px" }}>
      <h2>Interactive Diagram</h2>

      <div style={{ marginBottom: "10px", height: "8px", width: "700px", background: "#eee", borderRadius: "4px" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#2563eb", borderRadius: "4px", transition: "width 0.1s linear" }} />
      </div>

      <InteractiveLineChart
        width={700}
        height={260}
        features={features}
        onValueChange={updateFeatureValue}
        onToggleEnabled={toggleFeatureEnabled}
      />
    </div>
  );
}

export default App;
