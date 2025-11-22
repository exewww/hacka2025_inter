import React from 'react';
import InputBox from './components/InputBox';
import OutputDisplay from './components/OutputDisplay';
import { useInteractiveText } from './hooks/useInteractiveText';
import InteractiveLineChart from './components/InteractiveLineChart';

function App() {
  // 🕒 change 5 to any number of seconds you want
  const { text, setText, output, progress, isWaiting } = useInteractiveText(
    'Sentence 1. Sentence 2. Sentence 3.',
    5
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '20px',
        padding: '40px',
      }}
    >
      <InputBox
        text={text}
        onChange={setText}
        progress={progress}
        isWaiting={isWaiting}
      />

      {/* Output + Diagram stacked vertically */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: '20px',
        }}
      >
        <OutputDisplay output={output} />
        {/* NEW → Interactive Line Diagram */}
        <div
          style={{
            padding: '20px',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ marginBottom: '10px' }}>Interactive Diagram</h3>
          <InteractiveLineChart
            width={700}
            height={260}
            points={[0.6, 0.4, 0.7, 0.2, 0.5, 0.8]}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
