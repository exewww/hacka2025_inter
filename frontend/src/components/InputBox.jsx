import React from 'react';

export default function InputBox({ text, onChange, progress, isWaiting }) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <h3>Input</h3>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '16px',
          resize: 'none',
          borderRadius: '8px',
          border: '1px solid #ccc',
        }}
      />
      {/* Progress bar */}
      {isWaiting && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 0,
            height: '5px',
            width: `${progress}%`,
            background: '#4e79a7',
            borderRadius: '0 0 8px 8px',
            transition: 'width 0.1s linear',
          }}
        />
      )}
    </div>
  );
}
