export async function generateText(input) {
  const response = await fetch('http://localhost:5000/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const data = await response.json();
  return data.output;
}
