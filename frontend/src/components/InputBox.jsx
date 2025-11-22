import React from "react";

export default function InputBox({ value, onChange }) {
  return (
    <div
      style={{
        height: "100%",            // fill parent height (30% of left panel)
        padding: "6px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#fafafa",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <strong style={{ marginBottom: "4px" }}>Input:</strong>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,                // take all remaining vertical space
          width: "100%",
          padding: "6px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
