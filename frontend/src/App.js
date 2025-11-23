import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import InteractiveLineChart from './components/InteractiveLineChart';
import InteractiveTimeLineChart from './components/InteractiveTimeLineChart.jsx';
import OutputBox from './components/OutputBox';
import InputBox from './components/InputBox';

// Hooks
import { useFeaturePoints } from './hooks/useFeaturePoints';
import { useSuggestion } from './hooks/useSuggestion';
import { useInitialFeatures } from './hooks/useInitialFeatures';
import { useMilestones } from './hooks/useMilestones';

// --- STYLES ---
const styles = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '1.5rem',
    color: '#4b5563',
    fontWeight: '300',
    animation: 'pulse 2s infinite',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    padding: '20px',
    height: '100%',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  resizer: {
    width: '8px',
    cursor: 'col-resize',
    backgroundColor: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  roadmapList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    overflowY: 'auto',
    flex: 1,
  },
  roadmapItem: {
    display: 'flex',
    alignItems: 'baseline',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    color: '#374151',
  },
  dateBadge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '12px',
    marginRight: '10px',
    minWidth: '60px',
    textAlign: 'center',
  },
};

// --- INNER COMPONENT ---
const Dashboard = memo(({ initialFeatures, backendUrl }) => {
  const START_YEAR = 2025;

  // UI State
  const [inputValue, setInputValue] = useState('');
  const [capitalSeries, setCapitalSeries] = useState([]);

  const inputValueRef = useRef(inputValue);
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  // 1. Initialize Milestones Hook
  const { milestones, setMilestones, fetchMilestones, isLoadingMilestones } =
    useMilestones(backendUrl);

  const hasInitialized = useRef(false);

  // Callback when user drags points on the top chart
  const handleFeaturesUpdated = useCallback(
    (updatedFeatures) => {
      if (!hasInitialized.current) return;
      console.log('Features changed, regenerating milestones...');
      fetchMilestones(inputValueRef.current, updatedFeatures);
    },
    [fetchMilestones]
  );

  const { features, updateFeatureValue, toggleFeatureEnabled } =
    useFeaturePoints(
      initialFeatures,
      `${backendUrl}/generate`,
      handleFeaturesUpdated
    );

  // ============================================================
  // 🔥 POLLING: Check if Telegram Bot sent new data
  // ============================================================
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/check_for_updates`);
        const data = await res.json();

        // Check if there is an update object
        if (data.update) {
          console.log('🤖 Received Bot Update:', data.update);

          // --- 1. APPEND TEXT TO LETTER ---
          if (data.update.user_text) {
            setInputValue((prev) => {
              // If the box was empty, just set the new text
              if (!prev) return data.update.user_text;

              // If it had text, add a double newline + the new text
              // (Check if the new text is not already inside to avoid duplicates if you want)
              if (prev.includes(data.update.user_text)) return prev;

              return prev + '\n\n' + data.update.user_text;
            });
          }

          // --- 2. UPDATE MILESTONES ---
          if (data.update.milestones) {
            setMilestones(data.update.milestones);
          }
        }
      } catch (error) {
        // Silently fail if backend is offline
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [backendUrl, setMilestones]);

  // ============================================================
  // 🔥 CHAIN REACTION: When Milestones change -> Recalc Capital
  // ============================================================
  useEffect(() => {
    if (milestones.length > 0) {
      console.log('Milestones updated, fetching new Capital Series/Charts...');

      const fetchCapitalData = async () => {
        try {
          const response = await fetch(
            `${backendUrl}/generate_capital_series`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                features: features,
                milestones: milestones,
                letter: inputValueRef.current,
              }),
            }
          );

          if (!response.ok) throw new Error('Capital calc failed');
          const data = await response.json();

          if (data.capital_series) {
            setCapitalSeries(data.capital_series);
          }
        } catch (e) {
          console.error('Error fetching capital series:', e);
        }
      };
      fetchCapitalData();
    }
  }, [milestones, features, backendUrl]);

  // Initial Load
  useEffect(() => {
    if (!hasInitialized.current) {
      fetchMilestones(inputValueRef.current, features);
      hasInitialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suggestion Logic
  const [suggestion, requestSuggestion] = useSuggestion(
    'Click on a point or timeline event to get AI advice...',
    backendUrl,
    features,
    milestones,
    inputValueRef
  );

  // Layout & Resizing Logic
  const [leftWidth, setLeftWidth] = useState(35); // Percentage
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);
  const isResizing = useRef(false);

  // Update chart width when container resizes
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const totalW = containerRef.current.offsetWidth;
        const rightW = totalW * ((100 - leftWidth) / 100) - 60;
        setChartWidth(Math.max(400, rightW));
      }
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, [leftWidth]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
  }, []);
  const stopResizing = useCallback(() => {
    isResizing.current = false;
  }, []);
  const resize = useCallback((e) => {
    if (isResizing.current && containerRef.current) {
      const newWidth = (e.clientX / containerRef.current.offsetWidth) * 100;
      if (newWidth > 20 && newWidth < 60) {
        setLeftWidth(newWidth);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div ref={containerRef} style={styles.container}>
      {/* LEFT PANEL */}
      <div style={{ ...styles.panel, width: `${leftWidth}%` }}>
        {/* 1. Output Box (Top) */}
        <div style={{ ...styles.card, flex: '0 0 auto', minHeight: '150px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#6b7280' }}>
            AI Assistant
          </h4>
          <OutputBox value={suggestion} />
        </div>

        {/* 2. Roadmap (Middle - Flexible Height) */}
        {milestones.length > 0 && (
          <div style={{ ...styles.card, flex: '1 1 auto', minHeight: '200px' }}>
            <h4
              style={{
                margin: '0 0 10px 0',
                color: '#6b7280',
                borderBottom: '1px solid #eee',
                paddingBottom: '8px',
              }}
            >
              Life Roadmap
            </h4>
            <ul style={styles.roadmapList}>
              {milestones.map((m, i) => (
                <li key={i} style={styles.roadmapItem}>
                  <span style={styles.dateBadge}>{m.time}</span>
                  <span>{m.milestone}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Input Box (Bottom) */}
        <div style={{ ...styles.card, flex: '0 0 auto', height: '180px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#6b7280' }}>
            Your Context (Letter)
          </h4>
          <InputBox
            value={inputValue}
            onChange={setInputValue}
            onSend={() => fetchMilestones(inputValue, features)}
            isLoading={isLoadingMilestones}
          />
        </div>
      </div>

      {/* DRAGGER */}
      <div style={styles.resizer} onMouseDown={startResizing}>
        <div
          style={{
            width: '4px',
            height: '40px',
            backgroundColor: '#cbd5e1',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* RIGHT PANEL */}
      <div style={{ ...styles.panel, flex: 1, overflowY: 'auto' }}>
        {/* Features Chart */}
        <div
          style={{
            ...styles.card,
            minHeight: '350px',
            justifyContent: 'center',
          }}
        >
          <InteractiveLineChart
            width={chartWidth}
            height={300}
            features={features}
            onValueChange={updateFeatureValue}
            onToggleEnabled={toggleFeatureEnabled}
            onPointClick={requestSuggestion}
          />
        </div>

        {/* Financial Roadmap Chart */}
        <div
          style={{
            ...styles.card,
            minHeight: '350px',
            justifyContent: 'center',
          }}
        >
          <InteractiveTimeLineChart
            width={chartWidth}
            height={300}
            startYear={START_YEAR}
            milestones={milestones}
            seriesData={capitalSeries}
            onValueChange={updateFeatureValue}
            onToggleEnabled={toggleFeatureEnabled}
            onPointClick={requestSuggestion}
          />
        </div>
      </div>
    </div>
  );
});

// Main App Wrapper
function App() {
  const backendUrl = 'http://localhost:5000';
  const { features, loading, error } = useInitialFeatures(backendUrl);

  // --- LOADING SCREEN ---
  if (loading) {
    return (
      <div style={styles.loadingOverlay}>
        <div
          style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        >
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
          `}</style>
        </div>
        <h2 style={styles.loadingText}>AI Tool is getting ready...</h2>
      </div>
    );
  }

  if (error)
    return (
      <div style={{ padding: 20, color: 'red' }}>Error: {error.message}</div>
    );

  return <Dashboard initialFeatures={features} backendUrl={backendUrl} />;
}

export default App;
