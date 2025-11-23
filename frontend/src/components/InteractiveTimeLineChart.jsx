import React, { useState, useMemo } from "react";

export default function InteractiveTimeLineChart({
  milestones = [],   
  initialCapital = 0, 
  startYear = 2025, // <--- Passed from App.js
  width = 800,
  height = 400,
  padding = 60,
  smooth = true,
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  // 1. Sort Milestones Chronologically
  const sortedUserMilestones = useMemo(() => {
    return [...milestones].sort((a, b) => {
      const [ma, ya] = a.time.split("/");
      const [mb, yb] = b.time.split("/");
      const dateA = (2000 + parseInt(ya)) * 12 + parseInt(ma);
      const dateB = (2000 + parseInt(yb)) * 12 + parseInt(mb);
      return dateA - dateB;
    });
  }, [milestones]);

  // -------------------------------------------------------
  // 2. DYNAMIC ENDPOINT CALCULATION
  // -------------------------------------------------------
  
  // The chart ends at the year of the last milestone.
  const endYear = useMemo(() => {
    if (sortedUserMilestones.length === 0) return startYear + 1;
    
    const lastM = sortedUserMilestones[sortedUserMilestones.length - 1];
    const [, yStr] = lastM.time.split("/");
    const yVal = 2000 + parseInt(yStr, 10);
    
    // Ensure we have at least a 1-year span
    return Math.max(startYear + 1, yVal);
  }, [sortedUserMilestones, startYear]);

  // Generate the Years for the Grid (Start -> End)
  const gridYears = useMemo(() => {
    const arr = [];
    for (let y = startYear; y <= endYear; y++) {
      arr.push(y);
    }
    return arr;
  }, [startYear, endYear]);

  // 3. Construct Start Point
  const startYearShort = startYear.toString().slice(-2); 
  const startPointObj = {
    time: `01/${startYearShort}`,
    milestone: "Start",
    difficulty: 0, 
    reason: "Initial Capital available",
    capital: initialCapital,
    isStartNode: true,
  };

  const allPointsData = [startPointObj, ...sortedUserMilestones];

  // 4. Y-Axis Scaling (Capital)
  const allCapitals = allPointsData.map((m) => m.capital);
  const minCapital = Math.min(...allCapitals) * 0.8; 
  const maxCapital = Math.max(...allCapitals) * 1.1; 
  const capitalRange = maxCapital - minCapital || 1;

  // -------------------------------------------------------
  // HELPER FUNCTIONS
  // -------------------------------------------------------

  const getXForDate = (dateStr) => {
    if (!dateStr) return padding;
    const [monthStr, yearStr] = dateStr.split("/");
    const month = parseInt(monthStr, 10);
    const year = 2000 + parseInt(yearStr, 10);

    const yearDelta = year - startYear;
    const monthFraction = (month - 1) / 12;
    
    // X-Axis Scaling Logic:
    // We treat the span as (endYear - startYear). 
    // To ensure points in the final year (e.g. Dec 2027) fit, we map the end of endYear to the width.
    // If Grid is 2025, 2026, 2027. Span is 2 years (2025->2027).
    // If a point is in 2027, it falls on the last line.
    
    // Calculate total integer years in the chart
    const totalSegments = Math.max(1, endYear - startYear);
    
    // Calculate ratio
    const ratio = (yearDelta + monthFraction) / totalSegments;
    
    const px = padding + ratio * innerW;
    return Math.max(padding, Math.min(width - padding, px));
  };

  const getYForCapital = (val) => {
    const ratio = (val - minCapital) / capitalRange;
    return padding + (1 - ratio) * innerH;
  };

  const formatCurrency = (val) => {
    if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `€${(val / 1000).toFixed(0)}k`;
    return `€${val}`;
  };

  // -------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------

  const points = allPointsData.map((m) => ({
    ...m,
    x: getXForDate(m.time),
    y: getYForCapital(m.capital),
  }));

  const zones = [];
  for (let i = 0; i < points.length - 1; i++) {
    const pStart = points[i];
    const pEnd = points[i + 1];
    const zoneWidth = pEnd.x - pStart.x;
    
    if (zoneWidth > 0) {
      zones.push({
        x: pStart.x,
        width: zoneWidth,
        difficulty: pEnd.difficulty, 
      });
    }
  }
  
  // Fill remaining space to the right
  const lastPointX = points[points.length - 1].x;
  if (lastPointX < width - padding) {
    zones.push({
      x: lastPointX,
      width: (width - padding) - lastPointX,
      difficulty: 0, 
    });
  }

  const buildPath = (pts) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let d = `M ${pts[0].x} ${pts[0].y}`;
    if (!smooth) {
        pts.forEach((p, i) => { if(i>0) d+= ` L ${p.x} ${p.y}` });
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

  const linePath = buildPath(points);
  const areaPath = `${linePath} L ${points[points.length-1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

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
          {!hoveredPoint.isStartNode && (
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

        {/* ZONES */}
        {zones.map((z, i) => (
          <rect key={`zone-${i}`} x={z.x} y={padding} width={z.width} height={innerH} fill={getColorForDifficulty(z.difficulty)} opacity={0.12} />
        ))}

        {/* CAPITAL GRID (Horizontal) */}
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

        {/* YEAR GRID (Vertical) */}
        {gridYears.map((year) => {
           // Calculate ratio for grid lines
           const ratio = (year - startYear) / (endYear - startYear || 1);
           const xPos = padding + ratio * innerW;
           
           return (
             <g key={`vgrid-${year}`}>
               <line x1={xPos} x2={xPos} y1={padding} y2={height - padding} stroke="#f3f4f6" strokeDasharray="4 4" />
               <text x={xPos} y={height - padding + 24} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#6b7280">
                 {year}
               </text>
             </g>
           )
        })}

        {/* PATHS */}
        <path d={areaPath} fill="url(#lineGradient)" stroke="none" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" filter="url(#shadow)" />

        {/* POINTS */}
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
  const val = Math.max(0, Math.min(1, d));
  if (val < 0.5) {
    const t = val * 2;
    return `rgb(${34 + (234-34)*t}, ${197 + (179-197)*t}, ${94 + (8-94)*t})`;
  } else {
    const t = (val - 0.5) * 2;
    return `rgb(${234 + (239-234)*t}, ${179 + (68-179)*t}, ${8 + (68-8)*t})`;
  }
}