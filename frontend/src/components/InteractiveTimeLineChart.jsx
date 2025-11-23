import React, { useState, useMemo } from "react";

export default function InteractiveTimeLineChart({
  milestones = [], // Defines Vertical Separators & Zones
  seriesData = [], // Defines the Line Path & Points
  width = 800,
  height = 400,
  padding = 60,
  smooth = true,
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  // NEW: Track which vertical milestone line is being hovered
  const [hoveredMilestoneIdx, setHoveredMilestoneIdx] = useState(null);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  // -------------------------------------------------------
  // 1. HELPER: DATE MATH
  // -------------------------------------------------------
  const getMonthIndex = (dateStr) => {
    if (!dateStr) return 0;
    const parts = dateStr.split("/");
    const m = parseInt(parts[0], 10);
    let y = parseInt(parts[1], 10);
    if (y < 100) y += 2000;
    return y * 12 + (m - 1);
  };

  const formatIndexToLabel = (idx, showMonths) => {
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    if (showMonths) {
      const mStr = month.toString().padStart(2, "0");
      const yStr = year.toString().slice(-2);
      return `${mStr}/${yStr}`;
    }
    return `${year}`;
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return "€0";
    if (Math.abs(val) >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `€${(val / 1000).toFixed(0)}k`;
    return `€${val}`;
  };

  // -------------------------------------------------------
  // 2. PREPARE DATA
  // -------------------------------------------------------

  // A. Sort Series Data (The Line)
  const sortedSeries = useMemo(() => {
    return [...seriesData].sort(
      (a, b) => getMonthIndex(a.date) - getMonthIndex(b.date)
    );
  }, [seriesData]);

  // B. Sort Milestones (The Vertical Lines)
  const sortedMilestones = useMemo(() => {
    return [...milestones].sort(
      (a, b) => getMonthIndex(a.time) - getMonthIndex(b.time)
    );
  }, [milestones]);

  // C. Determine Chart Range (Start -> End)
  const rangeInfo = useMemo(() => {
    if (sortedSeries.length === 0 && sortedMilestones.length === 0)
      return { startIdx: 0, endIdx: 0, span: 1, mode: "year" };

    const seriesDates = sortedSeries.map((d) => getMonthIndex(d.date));
    const milestoneDates = sortedMilestones.map((m) => getMonthIndex(m.time));
    const allIndices = [...seriesDates, ...milestoneDates];

    const startIdx = Math.min(...allIndices);
    const endIdx = Math.max(...allIndices);
    const diffMonths = endIdx - startIdx;
    const span = Math.max(diffMonths, 1);
    const mode = diffMonths < 24 ? "month" : "year";

    return { startIdx, endIdx, span, mode };
  }, [sortedSeries, sortedMilestones]);

  const { startIdx, endIdx, span, mode } = rangeInfo;

  // -------------------------------------------------------
  // 3. SCALING
  // -------------------------------------------------------

  // Y-Axis
  const allCapitals = sortedSeries.map((d) => d.capital);
  const minCapital = allCapitals.length ? Math.min(...allCapitals) : 0;
  const maxCapital = allCapitals.length ? Math.max(...allCapitals) : 0;

  // Buffer for Y-Axis
  const yMin = minCapital - Math.abs(minCapital * 0.1 || 1000);
  const yMax = maxCapital + Math.abs(maxCapital * 0.1 || 1000);
  const capitalRange = yMax - yMin || 1;

  const getY = (val) => {
    const ratio = (val - yMin) / capitalRange;
    return padding + (1 - ratio) * innerH;
  };

  const getXForIndex = (idx) => {
    const ratio = (idx - startIdx) / span;
    const px = padding + ratio * innerW;
    return Math.max(padding, Math.min(width - padding, px));
  };

  const getX = (dateStr) => getXForIndex(getMonthIndex(dateStr));

  // -------------------------------------------------------
  // 4. GEOMETRY GENERATION
  // -------------------------------------------------------

  // A. SERIES LINE POINTS
  const linePoints = sortedSeries.map((d) => ({
    ...d,
    x: getX(d.date),
    y: getY(d.capital),
  }));

  // B. MILESTONE VERTICAL LINES
  const milestoneLines = sortedMilestones.map((m) => ({
    ...m,
    x: getX(m.time),
    label: m.milestone,
    idx: getMonthIndex(m.time),
  }));

  // C. BACKGROUND ZONES
  const zones = [];
  
  if (milestoneLines.length > 0 && milestoneLines[0].idx > startIdx) {
     zones.push({
        x: getXForIndex(startIdx),
        width: milestoneLines[0].x - getXForIndex(startIdx),
        difficulty: 0 
     });
  }

  for (let i = 0; i < milestoneLines.length; i++) {
    const current = milestoneLines[i];
    const next = milestoneLines[i + 1];
    const endX = next ? next.x : getXForIndex(endIdx);
    
    zones.push({
      x: current.x,
      width: endX - current.x,
      difficulty: current.difficulty || 0,
    });
  }

  // D. PATH BUILDER
  const buildPath = (pts) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let d = `M ${pts[0].x} ${pts[0].y}`;
    if (!smooth) {
      pts.forEach((p, i) => {
        if (i > 0) d += ` L ${p.x} ${p.y}`;
      });
      return d;
    }
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

  const pathD = buildPath(linePoints);
  const areaD =
    linePoints.length > 0
      ? `${pathD} L ${linePoints[linePoints.length - 1].x} ${height - padding} L ${linePoints[0].x} ${height - padding} Z`
      : "";

  // E. TICKS
  const gridTicks = [];
  if (mode === "month") {
    const step = span > 12 ? 3 : 1;
    for (let i = startIdx; i <= endIdx; i += step) {
      gridTicks.push({ value: i, label: formatIndexToLabel(i, true) });
    }
  } else {
    const startYear = Math.floor(startIdx / 12);
    const endYear = Math.floor(endIdx / 12);
    for (let y = startYear; y <= endYear; y++) {
      const janIdx = y * 12;
      if (janIdx >= startIdx && janIdx <= endIdx) {
        gridTicks.push({ value: janIdx, label: y.toString() });
      }
    }
  }

  // -------------------------------------------------------
  // 5. RENDER
  // -------------------------------------------------------
  return (
    <div style={{ position: "relative", width, fontFamily: "sans-serif" }}>
      
      {/* TOOLTIP - Uses Series Data */}
      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            left: hoveredPoint.x,
            top: hoveredPoint.y - 15,
            transform: "translate(-50%, -100%)",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            zIndex: 50,
            minWidth: "200px",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "13px", color: "#111", marginBottom: "4px" }}>
             {hoveredPoint.date}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12px" }}>
            <span style={{color: "#666"}}>Balance:</span>
            <span style={{ fontWeight: "700", color: hoveredPoint.capital < 0 ? "#dc2626" : "#2563eb" }}>
              {formatCurrency(hoveredPoint.capital)}
            </span>
          </div>

          {hoveredPoint.impact_value !== 0 && hoveredPoint.impact_value !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
               <span style={{color: "#666"}}>One-time:</span>
               <span style={{ fontWeight: "600", color: hoveredPoint.impact_value > 0 ? "#16a34a" : "#dc2626" }}>
                  {hoveredPoint.impact_value > 0 ? "+" : ""}
                  {formatCurrency(hoveredPoint.impact_value)}
               </span>
            </div>
          )}
          
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "2px" }}>
             <span style={{color: "#666"}}>Monthly:</span>
             <span style={{ fontWeight: "500", color: "#4b5563" }}>
                {hoveredPoint.monthly_flow > 0 ? "+" : ""}
                {formatCurrency(hoveredPoint.monthly_flow)}
             </span>
          </div>

          {hoveredPoint.event && (
              <div style={{marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #eee", fontSize: "11px", fontStyle: "italic", color: "#555"}}>
                  "{hoveredPoint.event}"
              </div>
          )}
        </div>
      )}

      <svg
        width={width}
        height={height}
        style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb" }}
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

        {/* 1. BACKGROUND ZONES */}
        {zones.map((z, i) => (
          <rect
            key={`zone-${i}`}
            x={z.x}
            y={padding}
            width={z.width}
            height={innerH}
            fill={getColorForDifficulty(z.difficulty)}
            opacity={0.15}
          />
        ))}

        {/* 2. GRID LINES */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yVal = padding + t * innerH;
          const val = yMax - t * capitalRange;
          return (
            <g key={`ygrid-${t}`}>
              <line x1={padding} x2={width - padding} y1={yVal} y2={yVal} stroke="#f3f4f6" />
              <text x={padding - 10} y={yVal + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {formatCurrency(val)}
              </text>
            </g>
          );
        })}
        
        {gridTicks.map((tick) => {
          const px = getXForIndex(tick.value);
          return (
            <g key={`xgrid-${tick.value}`}>
              <line x1={px} x2={px} y1={padding} y2={height - padding} stroke="#f3f4f6" strokeDasharray="4 4" />
              <text x={px} y={height - padding + 20} textAnchor="middle" fontSize="11" fill="#6b7280">
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* 3. MILESTONE SEPARATORS (Interactive) */}
        {milestoneLines.map((m, i) => {
            const isHovered = hoveredMilestoneIdx === i;
            return (
                <g 
                    key={`milestone-line-${i}`}
                    onMouseEnter={() => setHoveredMilestoneIdx(i)}
                    onMouseLeave={() => setHoveredMilestoneIdx(null)}
                    style={{ cursor: 'pointer' }}
                >
                    {/* Invisible Hit Area (Wider than the line to capture mouse events easily) */}
                    <rect 
                        x={m.x - 20} 
                        y={padding} 
                        width={40} 
                        height={innerH} 
                        fill="transparent" 
                    />

                    {/* Visible Line */}
                    <line 
                        x1={m.x} x2={m.x} 
                        y1={padding - 10} y2={height - padding} 
                        stroke={isHovered ? "#4f46e5" : "#6366f1"} 
                        strokeWidth={isHovered ? 2 : 1.5} 
                        strokeDasharray={isHovered ? "" : "6 4"} 
                        opacity={isHovered ? 1 : 0.6}
                    />

                    {/* Conditional Label */}
                    {isHovered && (
                        <g pointerEvents="none">
                            <rect 
                                x={m.x - (m.milestone.length * 4) - 8} 
                                y={padding - 35} 
                                width={(m.milestone.length * 8) + 16} 
                                height={24} 
                                rx={4} 
                                fill="rgba(255, 255, 255, 0.95)"
                                stroke="#4f46e5"
                                strokeWidth={1}
                            />
                            <text 
                                x={m.x} 
                                y={padding - 19} 
                                fontSize="12" 
                                fontWeight="bold" 
                                fill="#4f46e5"
                                textAnchor="middle"
                            >
                                {m.milestone}
                            </text>
                        </g>
                    )}

                    {/* Start Flag/Circle */}
                    <circle cx={m.x} cy={padding} r={isHovered ? 5 : 3} fill="#6366f1" />
                </g>
            );
        })}

        {/* 4. DATA LINE & AREA */}
        <path d={areaD} fill="url(#lineGradient)" stroke="none" />
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" filter="url(#shadow)" />

        {/* 5. INTERACTIVE POINTS */}
        {linePoints.map((p, i) => {
            return (
                <g
                    key={`pt-${i}`}
                    transform={`translate(${p.x}, ${p.y})`}
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: "pointer" }}
                >
                    <circle r={12} fill="transparent" />
                    {(p.event || hoveredPoint === p) && (
                        <circle 
                            r={hoveredPoint === p ? 6 : 4} 
                            fill="white" 
                            stroke={p.event ? "#2563eb" : "#93c5fd"} 
                            strokeWidth={2} 
                        />
                    )}
                </g>
            );
        })}

        {/* Zero Line */}
        {yMin < 0 && yMax > 0 && (
           <line 
             x1={padding} 
             x2={width - padding} 
             y1={getY(0)} 
             y2={getY(0)} 
             stroke="#000" 
             strokeOpacity={0.2} 
             strokeWidth={1} 
           />
        )}

      </svg>
    </div>
  );
}

// Helper: Color scale
function getColorForDifficulty(d) {
  const val = Math.max(0, Math.min(1, d || 0));
  if (val < 0.5) {
    const t = val * 2; 
    return `rgb(${34 + (250 - 34) * t}, ${197 + (204 - 197) * t}, ${94 + (21 - 94) * t})`;
  } else {
    const t = (val - 0.5) * 2;
    return `rgb(${250 + (220 - 250) * t}, ${204 + (38 - 204) * t}, ${21 + (38 - 21) * t})`;
  }
}