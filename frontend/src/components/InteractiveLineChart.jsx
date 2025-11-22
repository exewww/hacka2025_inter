// InteractiveLineChart.jsx
import React, { useRef } from "react";

export default function InteractiveLineChart({
  features = {},
  onValueChange,
  onToggleEnabled,
  width = 800, // now controlled by parent
  height = 240,
  padding = 50,
  smooth = true,
}) {
  const svgRef = useRef(null);
  const activeRef = useRef({ key: null, pointerId: null });

  const featureKeys = Object.keys(features);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const coords = featureKeys.map((key, i) => {
    const f = features[key];
    const x = padding + (i / (featureKeys.length - 1 || 1)) * innerW;
    const y = padding + (1 - f.value) * innerH;
    return { key, x, y, enabled: f.enabled, value: f.value };
  });

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

  const pathD = buildPath(coords);

  const onPointerDown = (e, key) => {
    if (!features[key].enabled) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    activeRef.current = { key, pointerId: e.pointerId };
  };

  const onPointerMove = (e) => {
    if (!activeRef.current.key || activeRef.current.pointerId !== e.pointerId) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
    let newY = 1 - (cursor.y - padding) / innerH;
    newY = Math.max(0, Math.min(1, newY));
    if (onValueChange) onValueChange(activeRef.current.key, Number(newY.toFixed(3)));
  };

  const onPointerUp = (e) => {
    if (!activeRef.current.key) return;
    e.target.releasePointerCapture(e.pointerId);
    activeRef.current = { key: null, pointerId: null };
  };

  return (
    <div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ background: "white", borderRadius: "8px", border: "1px solid #ccc" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line
            key={i}
            x1={padding}
            x2={width - padding}
            y1={padding + t * innerH}
            y2={padding + t * innerH}
            stroke="#eee"
          />
        ))}

        {/* Line path */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" />

        {/* Points */}
        {coords.map((c) => (
          <g key={c.key} transform={`translate(${c.x},${c.y})`}>
            <circle
              r={16}
              fill="transparent"
              style={{ cursor: c.enabled ? "ns-resize" : "not-allowed" }}
              onPointerDown={(e) => c.enabled && onPointerDown(e, c.key)}
            />
            <circle r={6} fill={c.enabled ? "#2563eb" : "#aaa"} stroke="white" strokeWidth={2} />
            <text y={-12} textAnchor="middle" fontSize="10" fill="#333">
              {c.key} ({Math.round(c.value * 100)}%)
            </text>
          </g>
        ))}

        {/* Lock/unlock icons */}
        {coords.map((c) => (
          <g
            key={c.key + "_icon"}
            transform={`translate(${c.x},${height - 20})`}
            style={{ cursor: "pointer" }}
            onClick={() => onToggleEnabled && onToggleEnabled(c.key)}
          >
            {c.enabled ? (
              <path d="M4 12V8a4 4 0 118 0v4M4 12h8v8H4z" fill="none" stroke="#2563eb" strokeWidth="2" />
            ) : (
              <path d="M4 12V8a4 4 0 018 0v4M4 12h8v8H4z" fill="none" stroke="#aaa" strokeWidth="2" />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
