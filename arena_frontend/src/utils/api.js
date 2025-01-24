export const fetchArenaSetup = async () => {
    const response = await fetch('/arena/setup', { method: 'POST' });
    const data = await response.json();
    return data;
  };
  
  export const startMatch = async (modelA, modelB) => {
    const response = await fetch('/arena/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelA, modelB }),
    });
    const data = await response.json();
    return data;
  };
  
  export const executeRound = async () => {
    const response = await fetch('/arena/round', { method: 'POST' });
    const data = await response.json();
    return data;
  };
  