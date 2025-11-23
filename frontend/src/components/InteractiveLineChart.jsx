import React, { useRef, useState } from "react";

// --- CONFIGURATION ---
const SCALING_CONFIG = {
  "Risk Tolerance": {
    min: 0,
    max: 1,
    unit: "",
    desc_0: "very risk-averse",
    desc_1: "very risk-seeking",
  },
  "Expected Annual Return": {
    min: 0,
    max: 20,
    unit: "%",
    desc_0: "0% return",
    desc_1: "20% return",
  },
  "Min. Apartment Size": {
    min: 20,
    max: 200,
    unit: "m²",
    desc_0: "very small",
    desc_1: "very large",
  },
  "Centrality": {
    min: 0,
    max: 1,
    unit: "",
    desc_0: "far from center",
    desc_1: "prime location",
  },
  "Years to Purchase": {
    min: 0,
    max: 10,
    unit: "years",
    desc_0: "immediate purchase",
    desc_1: "wait 10 years",
  },
  "Initial capital": { // <--- FIXED (was "Initial Capital")
    min: 0,
    max: 500000,
    unit: "€",
    desc_0: "very low capital",
    desc_1: "very high capital",
  },
  "Monthly Savings": {
    min: 0,
    max: 5000,
    unit: "€",
    desc_0: "low savings",
    desc_1: "high savings",
  },
  "Mortgage Interest Rate": {
    min: 0,
    max: 10,
    unit: "%",
    desc_0: "low interest",
    desc_1: "high interest",
  },
  "Mortgage Duration": {
    min: 1,
    max: 30,
    unit: "years",
    desc_0: "short mortgage",
    desc_1: "long mortgage",
  },
};

// --- HELPERS ---

/**
 * Formats a value based on the magnitude of the range.
 * - Large numbers (e.g. Capital): No decimals, comma separators.
 * - Small numbers (e.g. Interest): 1 or 2 decimals.
 */
const formatValue = (val, min, max) => {
  const range = max - min;
  // For large integers (like Capital or Savings)
  if (range > 100) {
    return Math.round(val).toLocaleString("en-US"); // e.g. "250,000"
  }
  // For small ranges (like 0-1)
  if (range <= 1) {
    return val.toFixed(2); // e.g. "0.55"
  }
  // For medium ranges (like 0-10%)
  return val.toFixed(1); // e.g. "3.5"
};

export default function InteractiveLineChart({
  features = {},
  onValueChange,
  onToggleEnabled,
  onPointClick,
  width = 800,
  height = 280,
  padding = 60,
  smooth = true,
}) {
  const svgRef = useRef(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);

  // We use a ref to track drag state without triggering re-renders during movement
  const activeRef = useRef({ key: null, pointerId: null, didMove: false });

  // Determine which config is currently "active" (hovered or dragged)
  // This determines what shows on the Y-Axis.
  const activeKey = draggingKey || hoveredKey;

  const featureKeys = Object.keys(features);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  // Helper to calculate real value string for a specific feature
  const getDisplayString = (key, normalizedValue) => {
    const conf = SCALING_CONFIG[key];
    if (!conf) return Math.round(normalizedValue * 100) + "%"; // Fallback

    const realValue = conf.min + normalizedValue * (conf.max - conf.min);
    const formatted = formatValue(realValue, conf.min, conf.max);
    return `${formatted} ${conf.unit}`.trim();
  };

  // Prepare coordinates and display values
  const coords = featureKeys.map((key, i) => {
    const f = features[key];
    const x = padding + (i / (featureKeys.length - 1 || 1)) * innerW;
    const y = padding + (1 - f.value) * innerH;
    const displayValue = getDisplayString(key, f.value);
    
    return { key, x, y, enabled: f.enabled, value: f.value, displayValue };
  });

  // -- Path Calculations --
  const buildPath = (coords) => {
    if (!coords.length) return "";
    if (!smooth || coords.length < 3) {
      return coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
    }
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] || coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const linePathD = buildPath(coords);
  const areaPathD = coords.length
    ? `${linePathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`
    : "";

  // -- Event Handlers --
  const onPointerDown = (e, key) => {
    if (!features[key].enabled) return;
    e.preventDefault();
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);

    activeRef.current = { key, pointerId: e.pointerId, didMove: false };
    setDraggingKey(key);
  };

  const onPointerMove = (e) => {
    if (!activeRef.current.key || activeRef.current.pointerId !== e.pointerId) return;
    
    activeRef.current.didMove = true;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

    let newY = 1 - (cursor.y - padding) / innerH;
    newY = Math.max(0, Math.min(1, newY)); // Clamp between 0 and 1

    if (onValueChange) {
      // Return the normalized value (0-1) to parent state
      onValueChange(activeRef.current.key, Number(newY.toFixed(3)));
    }
  };

  const onPointerUp = (e) => {
    if (!activeRef.current.key) return;
    e.target.releasePointerCapture(e.pointerId);
    setDraggingKey(null);
    activeRef.current = { key: null, pointerId: null, didMove: false };
  };

  const colors = {
    primary: "#3b82f6",
    primaryDark: "#2563eb",
    disabled: "#cbd5e1",
    disabledText: "#94a3b8",
    grid: "#f1f5f9",
    text: "#475569",
  };

  // -- Y-Axis Label Generation --
  // If a feature is active (hover/drag), show its specific units.
  // Otherwise, show generic percentages 0-100%.
  const yAxisSteps = [0, 0.25, 0.5, 0.75, 1];

  const getYLabel = (t) => {
    // t goes from 0 (bottom) to 1 (top)
    if (activeKey && SCALING_CONFIG[activeKey]) {
      const conf = SCALING_CONFIG[activeKey];
      const val = conf.min + t * (conf.max - conf.min);
      const formatted = formatValue(val, conf.min, conf.max);
      return `${formatted} ${conf.unit}`.trim();
    }
    // Default view when nothing is hovered
    return `${Math.round(t * 100)}%`;
  };

  return (
    <div style={{ fontFamily: "sans-serif", userSelect: "none" }}>
      <style>{`
        .point-inner { 
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-box: fill-box;
          transform-origin: center;
        }
        .point-group:hover .point-inner { 
          transform: scale(1.2); 
        }
        .lock-btn { transition: opacity 0.2s; opacity: 0.7; }
        .lock-btn:hover { opacity: 1; }
        .lock-btn:hover circle { stroke: ${colors.primary}; }
      `}</style>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          background: "white",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          cursor: draggingKey ? "grabbing" : "default",
          touchAction: "none",
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.primary} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors.primary} stopOpacity="0.0" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Grid & Y-Axis Labels */}
        {yAxisSteps.map((t, i) => {
          // SVG y coordinates: 0 is top, so we invert t for position
          const yPos = padding + (1 - t) * innerH; 
          
          return (
            <g key={i}>
              <line
                x1={padding}
                x2={width - padding}
                y1={yPos}
                y2={yPos}
                stroke={colors.grid}
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <text
                x={padding - 12}
                y={yPos + 4}
                textAnchor="end"
                fontSize="11"
                fill={activeKey ? colors.primaryDark : colors.disabledText}
                fontWeight={activeKey ? "bold" : "normal"}
              >
                {getYLabel(t)}
              </text>
            </g>
          );
        })}

        {/* Graph Area & Line */}
        <path d={areaPathD} fill="url(#chartGradient)" pointerEvents="none" />
        <path
          d={linePathD}
          fill="none"
          stroke={colors.primary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))" }}
        />

        {/* Interactive Points */}
        {coords.map((c) => {
          const isEnabled = c.enabled;
          const isHovered = hoveredKey === c.key;

          return (
            <g
              key={c.key}
              transform={`translate(${c.x},${c.y})`}
              className="point-group"
              onMouseEnter={() => setHoveredKey(c.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <g className="point-inner">
                
                {/* Visual: White halo border */}
                <circle
                  r={isEnabled ? 8 : 6}
                  fill="white"
                  stroke={isEnabled ? colors.primary : colors.disabled}
                  strokeWidth={2}
                  filter="url(#shadow)"
                  pointerEvents="none"
                />

                {/* Visual: Blue inner dot */}
                {isEnabled && (
                  <circle r={4} fill={colors.primary} pointerEvents="none" />
                )}

                {/* Label above point (Shows Real Value now) */}
                <g transform="translate(0, -24)" pointerEvents="none">
                  <text
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight={isHovered ? "600" : "400"}
                    fill={isEnabled ? colors.text : colors.disabledText}
                  >
                    {c.key}
                  </text>
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill={isEnabled ? colors.primaryDark : colors.disabledText}
                  >
                    {c.displayValue}
                  </text>
                </g>
              </g>

              {/* HIT AREA */}
              <circle
                r={20}
                fill="transparent"
                style={{ cursor: isEnabled ? "pointer" : "not-allowed" }}
                onPointerDown={(e) => isEnabled && onPointerDown(e, c.key)}
                onClick={() => {
                  if (isEnabled && !activeRef.current.didMove && onPointClick) {
                    onPointClick(c.key);
                  }
                }}
              />
            </g>
          );
        })}

        {/* Lock Icons */}
        {coords.map((c) => (
          <g
            key={c.key + "_lock"}
            className="lock-btn"
            transform={`translate(${c.x},${height - 25})`}
            style={{ cursor: "pointer" }}
            onClick={() => onToggleEnabled && onToggleEnabled(c.key)}
          >
            <circle
              r={14}
              fill="white"
              stroke={c.enabled ? "#e2e8f0" : "#f1f5f9"}
              strokeWidth={1}
            />
            <g transform="translate(-6, -6) scale(0.5)">
              {c.enabled ? (
                <path
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  fill="none"
                  stroke={colors.disabledText}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}