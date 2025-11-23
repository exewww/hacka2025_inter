import React from 'react';

export default function InputBox({ value, onChange, onSend, isLoading }) {
  // Handle Enter key to submit (optional)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      style={{
        height: '100%',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        background: '#fafafa',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px', // Adds space between elements
      }}
    >
      <strong style={{ color: '#333' }}>Your Plan / Letter:</strong>

      {/* Using textarea for better multi-line input */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your future plans here..."
        style={{
          flex: 1,
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          boxSizing: 'border-box',
          resize: 'none',
          fontFamily: 'inherit',
        }}
      />

      <button
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        style={{
          padding: '8px 16px',
          backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading || !value.trim() ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          transition: 'background 0.2s',
          alignSelf: 'flex-end', // Aligns button to the right
        }}
      >
        {isLoading ? 'Generating...' : 'Generate Milestones'}
      </button>
    </div>
  );
}
