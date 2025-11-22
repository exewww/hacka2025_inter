import React from "react";

export default function OutputBox({ value }) {
  return (
    <div
      style={{
        height: "100%",           // fill parent height
        padding: "10px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#f5f5f5",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <strong style={{ marginBottom: "6px" }}>Suggestion:</strong>
      <div
        style={{
          flex: 1,               // fill remaining height
          overflowY: "auto",     // scroll if content is long
        }}
      >
        {value}
      </div>
    </div>
  );
}
