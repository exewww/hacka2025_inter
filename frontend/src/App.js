// App.jsx
import React, { useRef, useState, useEffect } from "react";
import InteractiveLineChart from "./components/InteractiveLineChart";
import { useFeaturePoints } from "./hooks/useFeaturePoints";
import OutputBox from "./components/OutputBox";
import InputBox from "./components/InputBox";
import { useSuggestion } from "./hooks/useSuggestion";

function App() {
const initialFeatures = {
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


  const { features, updateFeatureValue, toggleFeatureEnabled, progress } =
    useFeaturePoints(initialFeatures, "http://localhost:5000/generate");

  const [suggestion] = useSuggestion(
    "suggestion here",
    "http://localhost:5000/generate",
    features
  );

  const [inputValue, setInputValue] = useState("");

  const [leftWidth, setLeftWidth] = useState(50); // % width
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  const [chartWidth, setChartWidth] = useState(400);
  const chartHeight = 260;

  // Update chart width based on left panel width
  useEffect(() => {
    function updateChartWidth() {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const leftPx = (leftWidth / 100) * containerWidth;
        const rightPx = containerWidth - leftPx - 5; // minus divider width
        const minRightPx = containerWidth * 0.4; // 40% min width
        setChartWidth(Math.max(rightPx, minRightPx));
      }
    }

    updateChartWidth();
    window.addEventListener("resize", updateChartWidth);
    return () => window.removeEventListener("resize", updateChartWidth);
  }, [leftWidth]);

  // Divider drag handlers
  const onMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;

    if (newLeftWidth < 20) newLeftWidth = 20;
    if (newLeftWidth > 60) newLeftWidth = 60;

    setLeftWidth(newLeftWidth);
  };

  const onMouseUp = () => {
    isDragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  const onMouseDown = () => {
    isDragging.current = true;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div style={{ padding: "40px", height: "100vh", boxSizing: "border-box" }}>
      <h2>Interactive Diagram</h2>
      <div
        ref={containerRef}
        style={{ display: "flex", width: "100%", height: "100%", gap: "10px" }}
      >
{/* Left panel */}
<div
  style={{
    width: `${leftWidth}%`,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    gap: "20px", // space between boxes
  }}
>
  {/* OutputBox takes ~60% */}
  <div style={{ flex: 6, minHeight: 0 }}>
    <OutputBox value={suggestion} />
  </div>

  {/* InputBox takes ~25% */}
  <div style={{ flex: 2.5, minHeight: 0 }}>
    <InputBox value={inputValue} onChange={setInputValue} />
  </div>
</div>

        {/* Divider */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: "5px",
            cursor: "col-resize",
            backgroundColor: "#ccc",
            userSelect: "none",
          }}
        />

        {/* Right panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ position: "relative" }}>
            {/* Progress bar */}
            <div
              style={{
                marginBottom: "10px",
                height: "8px",
                width: "100%",
                background: "#eee",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "#2563eb",
                  borderRadius: "4px",
                  transition: "width 0.1s linear",
                }}
              />
            </div>

            {/* First chart */}
            <InteractiveLineChart
              width={chartWidth}
              height={chartHeight}
              features={features}
              onValueChange={updateFeatureValue}
              onToggleEnabled={toggleFeatureEnabled}
            />
          </div>

          {/* Second chart */}
          <InteractiveLineChart
            width={chartWidth}
            height={chartHeight}
            features={features}
            onValueChange={updateFeatureValue}
            onToggleEnabled={toggleFeatureEnabled}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
