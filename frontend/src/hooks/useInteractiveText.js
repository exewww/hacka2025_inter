import { useState, useEffect, useRef } from 'react';
import { generateText } from '../services/api';

const splitSentences = (text) => {
  if (!text) return [];
  // Split by punctuation or line breaks
  return text
    .split(/(?<=[.!?])|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
};

export function useInteractiveText(initialText = '', delaySeconds = 5) {
  const [text, setText] = useState(initialText); // raw input
  const [outputSentences, setOutputSentences] = useState(
    splitSentences(initialText)
  ); // confirmed by backend
  const [progress, setProgress] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);

  const previousSentences = useRef(splitSentences(initialText)); // backend-confirmed
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);
    setIsWaiting(false);
  };

  useEffect(() => {
    const currentSentences = splitSentences(text);

    // Detect which sentences changed compared to backend-confirmed
    const changedIndexes = [];
    currentSentences.forEach((s, i) => {
      if (s !== previousSentences.current[i]) changedIndexes.push(i);
    });

    if (changedIndexes.length === 0) return;

    clearTimers();
    setIsWaiting(true);

    const totalMs = delaySeconds * 1000;
    const step = 100;
    let elapsed = 0;

    // Progress bar interval
    progressRef.current = setInterval(() => {
      elapsed += step;
      setProgress(Math.min((elapsed / totalMs) * 100, 100));
    }, step);

    // Wait for debounce and send only changed sentences to backend
    timerRef.current = setTimeout(async () => {
      clearTimers();
      for (const i of changedIndexes) {
        try {
          const result = await generateText(currentSentences[i]);
          setOutputSentences((prev) => {
            const newOut = [...prev];
            newOut[i] = result; // only update changed sentence
            return newOut;
          });
        } catch (err) {
          console.error('Backend error:', err);
        }
      }
      previousSentences.current = currentSentences;
    }, totalMs);

    return () => clearTimers();
  }, [text, delaySeconds]);

  return {
    text,
    setText,
    output: outputSentences.join(' '), // only backend-confirmed sentences
    progress,
    isWaiting,
  };
}
