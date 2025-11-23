import React, { useState, useMemo } from "react";

export default function InteractiveTimeLineChart({
  milestones = [],
  width = 800,
  height = 400,
  padding = 60,
  smooth = true,
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  // -------------------------------------------------------
  // 1. HELPER: DATE MATH (Total Months)
  // -------------------------------------------------------
  // Converts "11/2025" or "11/25" into a single integer (Total Months)
  // e.g. Year 2025 * 12 + 11
  const getMonthIndex = (dateStr) => {
    if (!dateStr) return 0;
    const parts = dateStr.split("/");
    const m = parseInt(parts[0], 10);
    let y = parseInt(parts[1], 10);
    // Handle 2-digit years (e.g., 25 -> 2025)
    if (y < 100) y += 2000;
    
    return y * 12 + (m - 1); // 0-indexed months for easier math
  };

  // Converts Total Months back to label
  // e.g. index -> "11/25" or "2025" depending on mode
  const formatIndexToLabel = (idx, showMonths) => {
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    
    if (showMonths) {
      const mStr = month.toString().padStart(2, "0");
      const yStr = year.toString().slice(-2);
      return `${mStr}/${yStr}`;
    } else {
      return `${year}`;
    }
  };

  // -------------------------------------------------------
  // 2. PROCESS DATA
  // -------------------------------------------------------

  // A. Sort Milestones Chronologically
  const sortedPoints = useMemo(() => {
    if (!milestones || milestones.length === 0) return [];
    return [...milestones].sort((a, b) => {
      return getMonthIndex(a.time) - getMonthIndex(b.time);
    }).map((m, i) => ({
      ...m,
      // Mark the chronologically first point as the Start Node
      isStartNode: i === 0 
    }));
  }, [milestones]);

  // B. Determine Range (Start -> End)
  const rangeInfo = useMemo(() => {
    if (sortedPoints.length === 0) return { startIdx: 0, endIdx: 0, span: 1, mode: "year" };

    const startIdx = getMonthIndex(sortedPoints[0].time);
    const endIdx = getMonthIndex(sortedPoints[sortedPoints.length - 1].time);
    
    // Calculate difference in months
    const diffMonths = endIdx - startIdx;
    
    // Ensure span is at least 1 to avoid division by zero
    const span = Math.max(diffMonths, 1);

    // LOGIC: If less than 24 months (2 years), show Month Grid. Else show Year Grid.
    const mode = diffMonths < 24 ? "month" : "year";

    return { startIdx, endIdx, span, mode };
  }, [sortedPoints]);

  const { startIdx, endIdx, span, mode } = rangeInfo;

  // -------------------------------------------------------
  // 3. GENERATE GRID TICKS
  // -------------------------------------------------------
  const gridTicks = useMemo(() => {
    const ticks = [];

    if (mode === "month") {
      // MONTH MODE: Show ticks every X months depending on density
      // If span is tiny (e.g. 6 months), show every month.
      // If span is 23 months, show every 3 months to prevent overcrowding.
      const step = span > 12 ? 3 : 1; 

      // Align to the start index
      for (let i = startIdx; i <= endIdx; i += step) {
        ticks.push({ 
          value: i, 
          label: formatIndexToLabel(i, true) 
        });
      }

    } else {
      // YEAR MODE: Show ticks for every Jan 1st within the range
      // 1. Find the first January that falls on or after startIdx
      const startYear = Math.floor(startIdx / 12);
      const endYear = Math.floor(endIdx / 12);

      for (let y = startYear; y <= endYear; y++) {
        const janIdx = y * 12; // Index for January of year y
        // Only add if it's within visual bounds (or close enough)
        if (janIdx >= startIdx && janIdx <= endIdx) {
          ticks.push({ value: janIdx, label: y.toString() });
        }
      }
      // Optional: If Start Point isn't Jan 1, maybe force a label for the Start Year? 
      // For now, standard year grid lines are usually cleaner.
    }
    return ticks;
  }, [startIdx, endIdx, span, mode]);


  // -------------------------------------------------------
  // 4. SCALING FUNCTIONS
  // -------------------------------------------------------

  // Y-Axis (Capital)
  const allCapitals = sortedPoints.map((m) => m.capital);
  const minCapital = Math.min(...allCapitals) * 0.9; 
  const maxCapital = Math.max(...allCapitals) * 1.1; 
  const capitalRange = maxCapital - minCapital || 1;

  const getY = (val) => {
    const ratio = (val - minCapital) / capitalRange;
    return padding + (1 - ratio) * innerH;
  };

  const getX = (dateStr) => {
    const currentIdx = getMonthIndex(dateStr);
    const ratio = (currentIdx - startIdx) / span;
    const px = padding + ratio * innerW;
    return Math.max(padding, Math.min(width - padding, px));
  };

  const getXForTick = (idxValue) => {
    const ratio = (idxValue - startIdx) / span;
    const px = padding + ratio * innerW;
    return px;
  };

  const formatCurrency = (val) => {
    if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `€${(val / 1000).toFixed(0)}k`;
    return `€${val}`;
  };

  // -------------------------------------------------------
  // 5. RENDER OBJECTS
  // -------------------------------------------------------

  const points = sortedPoints.map((m) => ({
    ...m,
    x: getX(m.time),
    y: getY(m.capital),
  }));

  const zones = [];
  for (let i = 0; i < points.length - 1; i++) {
    const pStart = points[i];
    const pEnd = points[i + 1];
    zones.push({
      x: pStart.x,
      width: pEnd.x - pStart.x,
      difficulty: pEnd.difficulty,
    });
  }

  // Path Builder
  const buildPath = (pts) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let d = `M ${pts[0].x} ${pts[0].y}`;
    if (!smooth) {
      pts.forEach((p, i) => { if (i > 0) d += ` L ${p.x} ${p.y}`; });
      return d;
    }
    // Cubic Bezier Smoothing
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const linePath = buildPath(points);
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length-1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : "";

  return (
    <div style={{ position: "relative", width: width, fontFamily: "sans-serif" }}>
      {/* TOOLTIP */}
      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            left: hoveredPoint.x,
            top: hoveredPoint.y - 12,
            transform: "translate(-50%, -100%)",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
            boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.15)",
            zIndex: 50,
            minWidth: "220px",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#111", marginBottom: "4px" }}>
            {hoveredPoint.milestone}
          </div>
          <div style={{ fontSize: "12px", color: "#666", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>{hoveredPoint.time}</span>
            <span style={{ fontWeight: "700", color: "#2563eb" }}>{formatCurrency(hoveredPoint.capital)}</span>
          </div>
          {hoveredPoint.reason && (
            <div style={{ marginTop: "6px", fontSize: "11px", color: "#555", lineHeight: "1.4", borderTop:"1px solid #eee", paddingTop:"6px" }}>
              {hoveredPoint.reason}
            </div>
          )}
          {!hoveredPoint.isStartNode && hoveredPoint.difficulty !== undefined && (
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1, height: "6px", background: "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${hoveredPoint.difficulty * 100}%`, background: getColorForDifficulty(hoveredPoint.difficulty), height: "100%" }}></div>
                </div>
                <span style={{ fontSize: "10px", color: "#999", fontWeight: "500" }}>Diff</span>
            </div>
          )}
        </div>
      )}

      <svg
        width={width}
        height={height}
        style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.15" />
          </filter>
          <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* ZONES (Background Coloring) */}
        {zones.map((z, i) => (
          <rect key={`zone-${i}`} x={z.x} y={padding} width={z.width} height={innerH} fill={getColorForDifficulty(z.difficulty)} opacity={0.12} />
        ))}

        {/* HORIZONTAL GRID (Capital) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yVal = padding + t * innerH;
          const capitalVal = maxCapital - t * capitalRange;
          return (
            <g key={`hgrid-${t}`}>
              <line x1={padding} x2={width - padding} y1={yVal} y2={yVal} stroke="#f3f4f6" strokeWidth="1" />
              <text x={padding - 12} y={yVal + 4} textAnchor="end" fontSize="11" fill="#9ca3af" fontWeight="500">
                {formatCurrency(capitalVal)}
              </text>
            </g>
          );
        })}

        {/* VERTICAL GRID (Time) - Dynamic Years or Months */}
        {gridTicks.map((tick) => {
           const xPos = getXForTick(tick.value);
           // Prevent drawing outside the chart area
           if (xPos < padding - 1 || xPos > width - padding + 1) return null;

           return (
             <g key={`vgrid-${tick.value}`}>
               <line x1={xPos} x2={xPos} y1={padding} y2={height - padding} stroke="#f3f4f6" strokeDasharray="4 4" />
               <text x={xPos} y={height - padding + 24} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#6b7280">
                 {tick.label}
               </text>
             </g>
           )
        })}

        {/* DATA LINES & AREA */}
        <path d={areaPath} fill="url(#lineGradient)" stroke="none" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" filter="url(#shadow)" />

        {/* DATA POINTS */}
        {points.map((p, i) => (
          <g
            key={`pt-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            onMouseEnter={() => setHoveredPoint(p)}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ cursor: "pointer" }}
          >
            <circle r={15} fill="transparent" />
            <circle 
                r={p.isStartNode ? 5 : 6} 
                fill={p.isStartNode ? "#3b82f6" : "white"} 
                stroke="#3b82f6" 
                strokeWidth={2}
                style={{ transition: "all 0.2s ease" }}
            />
            {hoveredPoint === p && <circle r={10} fill="none" stroke="#3b82f6" strokeOpacity="0.3" strokeWidth={4} />}
          </g>
        ))}
      </svg>
    </div>
  );
}

function getColorForDifficulty(d) {
  const val = Math.max(0, Math.min(1, d || 0));
  if (val < 0.5) {
    const t = val * 2;
    return `rgb(${34 + (234-34)*t}, ${197 + (179-197)*t}, ${94 + (8-94)*t})`;
  } else {
    const t = (val - 0.5) * 2;
    return `rgb(${234 + (239-234)*t}, ${179 + (68-179)*t}, ${8 + (68-8)*t})`;
  }
}