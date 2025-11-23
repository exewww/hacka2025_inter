import React, { useRef, useState } from "react";

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

  const featureKeys = Object.keys(features);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const coords = featureKeys.map((key, i) => {
    const f = features[key];
    const x = padding + (i / (featureKeys.length - 1 || 1)) * innerW;
    const y = padding + (1 - f.value) * innerH;
    return { key, x, y, enabled: f.enabled, value: f.value };
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
    e.stopPropagation(); // Prevent bubbling
    e.target.setPointerCapture(e.pointerId);

    activeRef.current = { 
      key, 
      pointerId: e.pointerId, 
      didMove: false 
    };
    setDraggingKey(key);
  };

  const onPointerMove = (e) => {
    if (!activeRef.current.key || activeRef.current.pointerId !== e.pointerId) return;
    
    activeRef.current.didMove = true;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    // Map screen coordinates to SVG coordinates
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

    let newY = 1 - (cursor.y - padding) / innerH;
    newY = Math.max(0, Math.min(1, newY)); // Clamp between 0 and 1

    if (onValueChange) {
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

  return (
    <div style={{ fontFamily: "sans-serif", userSelect: "none" }}>
      <style>{`
        /* Only scale the inner group, not the positioned parent */
        .point-inner { 
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-box: fill-box;
          transform-origin: center;
        }
        .point-group:hover .point-inner { 
          transform: scale(1.2); 
        }
        /* Lock icon hover effect */
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
          touchAction: "none", // Important for dragging on touch devices
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

        {/* Grid & Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line
              x1={padding}
              x2={width - padding}
              y1={padding + t * innerH}
              y2={padding + t * innerH}
              stroke={colors.grid}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            <text
              x={padding - 12}
              y={padding + t * innerH + 4}
              textAnchor="end"
              fontSize="11"
              fill={colors.disabledText}
            >
              {Math.round((1 - t) * 100)}%
            </text>
          </g>
        ))}

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
              // 1. Position is handled here via transform attribute
              transform={`translate(${c.x},${c.y})`}
              className="point-group"
              onMouseEnter={() => setHoveredKey(c.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              {/* 2. Scaling is handled in this inner group via CSS class */}
              <g className="point-inner">
                
                {/* Visual: White halo border */}
                <circle
                  r={isEnabled ? 8 : 6}
                  fill="white"
                  stroke={isEnabled ? colors.primary : colors.disabled}
                  strokeWidth={2}
                  filter="url(#shadow)"
                  pointerEvents="none" // Click passes through to the invisible hit area
                />

                {/* Visual: Blue inner dot */}
                {isEnabled && (
                  <circle r={4} fill={colors.primary} pointerEvents="none" />
                )}

                {/* Label above point */}
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
                    {Math.round(c.value * 100)}%
                  </text>
                </g>
              </g>

              {/* HIT AREA: Invisible large circle that handles the events */}
              {/* This is OUTSIDE the scaled group to prevent coordinate jitter during scale */}
              <circle
                r={20}
                fill="transparent"
                style={{ cursor: isEnabled ? "pointer" : "not-allowed" }}
                onPointerDown={(e) => isEnabled && onPointerDown(e, c.key)}
                onClick={() => {
                  // Only click if not dragged
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