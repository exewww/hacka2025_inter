import React, { useRef, useState, useEffect, useCallback, memo } from "react";
import InteractiveLineChart from "./components/InteractiveLineChart";
import InteractiveTimeLineChart from "./components/InteractiveTimeLineChart.jsx";
import OutputBox from "./components/OutputBox";
import InputBox from "./components/InputBox";

// Hooks
import { useFeaturePoints } from "./hooks/useFeaturePoints";
import { useSuggestion } from "./hooks/useSuggestion";
import { useInitialFeatures } from "./hooks/useInitialFeatures"; 
import { useMilestones } from "./hooks/useMilestones"; 

// --- INNER COMPONENT (Wrapped in memo) ---
const Dashboard = memo(({ initialFeatures, backendUrl }) => {
  
  // 1. HARDCODED START YEAR
  const START_YEAR = 2025;

  // 2. UI State
  const [inputValue, setInputValue] = useState("");
  
  // Keep a ref of inputValue so callbacks can read it without adding it to dependency arrays
  const inputValueRef = useRef(inputValue);
  useEffect(() => { inputValueRef.current = inputValue; }, [inputValue]);

  // 3. Initialize Milestones Hook
  const { milestones, fetchMilestones, isLoadingMilestones } = useMilestones(backendUrl);

  // --- GUARD REF: Tracks if the initial 'on-mount' generation is done ---
  const hasInitialized = useRef(false);

  // 4. Define Callback: Triggered ONLY when Chart interaction finishes
  const handleFeaturesUpdated = useCallback((updatedFeatures) => {
    // Prevent the chart from triggering an update BEFORE 
    // the initialization useEffect has run.
    if (!hasInitialized.current) return;

    console.log("Plot changed (user interaction), regenerating milestones...");
    fetchMilestones(inputValueRef.current, updatedFeatures);
  }, [fetchMilestones]);

  // 5. Initialize Feature Logic
  const { features, updateFeatureValue, toggleFeatureEnabled, progress } =
    useFeaturePoints(
      initialFeatures, 
      `${backendUrl}/generate`, 
      handleFeaturesUpdated 
    );

  // 6. INITIALIZATION EFFECT (Runs exactly ONCE)
  useEffect(() => {
    if (!hasInitialized.current) {
      console.log("Initial Milestone Generation (One-time on mount)...");
      fetchMilestones(inputValueRef.current, features);
      
      // Mark as done. Now the handleFeaturesUpdated callback is allowed to run.
      hasInitialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // 7. Calculate Start Capital (FIXED)
  // Checks multiple key variations (with space, without space, camelCase)
  const rawCapital = 
    features["Initial Capital"]?.value || 
    features["InitialCapital"]?.value || 
    features["initialCapital"]?.value || 
    0;

  const startCapital = rawCapital * 1000000; 

  // 8. Initialize Suggestion Hook
  const [suggestion, requestSuggestion] = useSuggestion(
    "Click on a point to get specific advice...",
    backendUrl,
    features
  );

  // 9. Resize / Layout Logic
  const [leftWidth, setLeftWidth] = useState(40); 
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const [chartWidth, setChartWidth] = useState(600);
  const chartHeight = 300;

  // (Optional) Manual Trigger via Send Button
  const handleSendClick = () => {
    fetchMilestones(inputValue, features);
  };

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      const leftPx = (leftWidth / 100) * w;
      const rightPx = w - leftPx - 10; 
      setChartWidth(Math.max(rightPx, 300)); 
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [leftWidth]);

  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.max(20, Math.min(60, pct)); 
    setLeftWidth(pct);
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
    <div style={{ display: "flex", width: "100%", height: "100%", gap: "10px" }} ref={containerRef}>
      
      {/* --- LEFT PANEL --- */}
      <div style={{ width: `${leftWidth}%`, display: "flex", flexDirection: "column", gap: "15px", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
          <div style={{ minHeight: "100px" }}>
            <OutputBox value={suggestion} />
          </div>
          
          {milestones.length > 0 && (
            <div style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "10px", background: "#f9fafb", fontSize: "14px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>Your Roadmap:</h4>
              <ul style={{ paddingLeft: "20px", margin: 0 }}>
                {milestones.map((m, i) => (
                  <li key={i} style={{ marginBottom: "8px" }}>
                    <strong>{m.time}</strong>: {m.milestone} <br/>
                    <span style={{ color: "#666", fontSize: "12px" }}>(Diff: {m.difficulty}) - {m.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div style={{ height: "180px", flexShrink: 0 }}>
          <InputBox 
            value={inputValue} 
            onChange={setInputValue} 
            onSend={handleSendClick}         
            isLoading={isLoadingMilestones}  
          />
        </div>
      </div>

      {/* --- DIVIDER --- */}
      <div onMouseDown={onMouseDown} style={{ width: "5px", cursor: "col-resize", background: "#e5e7eb", borderRadius: "2px" }} />

      {/* --- RIGHT PANEL --- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
        <div style={{ height: "6px", background: "#eee", borderRadius: "3px", width: "100%" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#2563eb", borderRadius: "3px", transition: "width 0.2s ease-out" }} />
        </div>

        <InteractiveLineChart
          width={chartWidth}
          height={chartHeight}
          features={features}
          onValueChange={updateFeatureValue}
          onToggleEnabled={toggleFeatureEnabled}
          onPointClick={requestSuggestion}
        />

        <InteractiveTimeLineChart
          width={chartWidth}
          height={chartHeight}
          startYear={START_YEAR}
          milestones={milestones}
          initialCapital={startCapital}
          onValueChange={updateFeatureValue} 
          onToggleEnabled={toggleFeatureEnabled}
          onPointClick={requestSuggestion} 
        />
      </div>
    </div>
  );
});

// --- MAIN APP COMPONENT ---
function App() {
  const backendUrl = "http://localhost:5000";
  const { features: loadedFeatures, loading, error } = useInitialFeatures(backendUrl);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#555", fontFamily: "sans-serif" }}>
        <h3>Initializing AI Financial Model...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "red", padding: "40px", fontFamily: "sans-serif" }}>
        <h3>Error loading data.</h3>
        <p>Is the backend running at <code>{backendUrl}</code>?</p>
        <pre>{error.message}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", height: "100vh", boxSizing: "border-box", fontFamily: "sans-serif" }}>
      <h2 style={{ margin: "0 0 20px 0", color: "#111827" }}>Real Estate AI Planner</h2>
      <div style={{ height: "calc(100% - 60px)" }}>
        <Dashboard initialFeatures={loadedFeatures} backendUrl={backendUrl} />
      </div>
    </div>
  );
}

export default App;