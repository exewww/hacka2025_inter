import React from 'react';

export default function OutputDisplay({ output }) {
  return (
    <div style={{ flex: 1, marginLeft: '20px' }}>
      <h3>Output</h3>
      <div
        style={{
          background: '#f8f8f8',
          padding: '10px',
          minHeight: '200px',
          whiteSpace: 'pre-wrap',
          borderRadius: '8px',
        }}
      >
        {output || 'Start typing...'}
      </div>
    </div>
  );
}
