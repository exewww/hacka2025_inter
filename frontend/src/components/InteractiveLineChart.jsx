import React, { useState, useRef } from 'react';

export default function InteractiveLineChart({
  width = 800,
  height = 240,
  padding = 36,
  points: initialPoints = [], // 👈 values come from parent
  onChange, // optional callback to parent
  smooth = true,
}) {
  const [points, setPoints] = useState(initialPoints);
  const svgRef = useRef(null);
  const activeRef = useRef({ index: null, pointerId: null });

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const coords = points.map((v, i) => {
    const x = padding + (i / (points.length - 1 || 1)) * innerW;
    const y = padding + v * innerH;
    return { x, y };
  });

  function updatePoint(idx, newValue) {
    setPoints((prev) => {
      const next = [...prev];
      next[idx] = newValue;

      if (onChange) onChange(next); // 🔥 send updated points back to parent

      return next;
    });
  }

  function buildPath(coords) {
    if (!coords.length) return '';
    if (!smooth || coords.length < 3) {
      return coords
        .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`)
        .join(' ');
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
  }

  const pathD = buildPath(coords);

  function onPointerDown(e, idx) {
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    activeRef.current = { index: idx, pointerId: e.pointerId };
  }

  function onPointerMove(e) {
    if (activeRef.current.index === null) return;
    if (activeRef.current.pointerId !== e.pointerId) return;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
    let newY = (cursor.y - padding) / innerH;

    newY = Math.max(0, Math.min(1, newY));
    updatePoint(activeRef.current.index, Number(newY.toFixed(4)));
  }

  function onPointerUp(e) {
    if (activeRef.current.index === null) return;
    e.target.releasePointerCapture(e.pointerId);
    activeRef.current = { index: null, pointerId: null };
  }

  function onKeyDown(e, idx) {
    const step = 0.02;
    if (e.key === 'ArrowUp' || e.key === 'w') {
      e.preventDefault();
      updatePoint(idx, Math.max(0, points[idx] - step));
    }
    if (e.key === 'ArrowDown' || e.key === 's') {
      e.preventDefault();
      updatePoint(idx, Math.min(1, points[idx] + step));
    }
  }

  return (
    <div className="w-full p-2">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: 'white', borderRadius: '8px' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* grid */}
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

        {/* path */}
        <path
          d={pathD}
          fill="none"
          stroke="#2563eb"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* points */}
        {coords.map((c, idx) => (
          <g key={idx} transform={`translate(${c.x}, ${c.y})`}>
            <circle
              r={18}
              fill="transparent"
              style={{ cursor: 'ns-resize' }}
              onPointerDown={(e) => onPointerDown(e, idx)}
            />
            <circle
              r={6}
              fill="white"
              stroke="#2563eb"
              strokeWidth="2"
              tabIndex={0}
              onKeyDown={(e) => onKeyDown(e, idx)}
            />
            <text x={0} y={-12} textAnchor="middle" fontSize="10" fill="#333">
              {Math.round((1 - points[idx]) * 100)}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
