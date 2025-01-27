import React, { useState, useEffect } from 'react';
import { setupArena, startMatch, executeRound } from '../services/api';

const AdminPanel: React.FC = () => {
  const [modelA, setModelA] = useState('');
  const [modelB, setModelB] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [websocket, setWebSocket] = useState<WebSocket | null>(null);

  // WebSocket connection setup
  const connectWebSocket = () => {
    const ws = new WebSocket('ws://127.0.0.1:8000/stream');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
  
      // Eğer bu round zaten eklenmişse, tekrar ekleme
      setRounds((prevRounds) => {
        if (prevRounds.some((round) => round.round === data.round)) {
          return prevRounds;
        }
        return [...prevRounds, data];
      });
  
      setLogs((prevLogs) => [...prevLogs, `New round: ${data.round}`]);
    };
    ws.onopen = () => setLogs((prev) => [...prev, 'WebSocket connection established.']);
    ws.onclose = () => setLogs((prev) => [...prev, 'WebSocket connection closed.']);
    ws.onerror = (error) => console.error('WebSocket error:', error);
  
    setWebSocket(ws);
  };

  const handleSetup = async () => {
    const response = await setupArena();
    setLogs((prev) => [...prev, 'Arena setup completed!']);
    console.log(response);
  };

  const handleStart = async () => {
    if (modelA && modelB) {
      const response = await startMatch(modelA, modelB);
      setLogs((prev) => [...prev, 'Match started!']);
      console.log(response);
      connectWebSocket(); // Connect WebSocket after starting the match
    } else {
      alert('Please select both Model A and Model B');
    }
  };

  const handleExecuteRound = async () => {
    const response = await executeRound();
    setLogs((prev) => [...prev, `Round executed: ${response.message}`]);
    console.log(response);
  };

  // Clean up WebSocket connection on component unmount
  useEffect(() => {
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [websocket]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>

      {/* Setup Arena */}
      <button
        onClick={handleSetup}
        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded text-lg mb-4"
      >
        Setup Arena
      </button>

      {/* Model Selection and Start Match */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Model A"
          value={modelA}
          onChange={(e) => setModelA(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white mr-2"
        />
        <input
          type="text"
          placeholder="Model B"
          value={modelB}
          onChange={(e) => setModelB(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white mr-2"
        />
        <button
          onClick={handleStart}
          className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded text-lg"
        >
          Start Match
        </button>
      </div>

      {/* Execute Round */}
      <button
        onClick={handleExecuteRound}
        className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded text-lg mb-4"
      >
        Execute Round
      </button>

      {/* Match Logs */}
      <div className="mb-4">
        <h2 className="text-2xl font-semibold mb-2">Logs:</h2>
        <ul className="bg-gray-800 rounded p-4">
          {logs.map((log, index) => (
            <li key={index} className="mb-1">
              {log}
            </li>
          ))}
        </ul>
      </div>

      {/* Rounds */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Rounds:</h2>
        <div className="space-y-4">
          {rounds.map((round, index) => (
            <div key={index} className="p-4 bg-gray-800 rounded shadow-md">
              <p>
                <strong>Round:</strong> {round.round}
              </p>
              <p>
                <strong>Model A:</strong> {round.model_a}
              </p>
              <p>
                <strong>Argument A:</strong> {round.argument_a}
              </p>
              <p>
                <strong>Model B:</strong> {round.model_b}
              </p>
              <p>
                <strong>Argument B:</strong> {round.argument_b}
              </p>
              <p>
                <strong>Judge Feedback:</strong> {round.judge_feedback}
              </p>
              <p>
                <strong>Score A:</strong> {round.score_a.toFixed(2)}
              </p>
              <p>
                <strong>Score B:</strong> {round.score_b.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
