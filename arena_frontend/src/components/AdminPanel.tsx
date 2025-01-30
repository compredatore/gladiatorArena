import React, { useState, useEffect } from 'react';
import { setupArena, startMatch, executeRound } from '../services/api';

interface RoundData {
  round_number: number;
  responses: Record<string, string>;
  judge_response: string;
}

const AdminPanel: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [websocket, setWebSocket] = useState<WebSocket | null>(null);

  // WebSocket connection setup
  const connectWebSocket = () => {
    const ws = new WebSocket('ws://127.0.0.1:8000/stream');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRounds((prevRounds) => {
        if (prevRounds.some((round) => round.round_number === data.round_number)) {
          return prevRounds;
        }
        return [...prevRounds, data];
      });
      setLogs((prevLogs) => [...prevLogs, `New round: ${data.round_number}`]);
    };
    ws.onopen = () => setLogs((prev) => [...prev, 'WebSocket connection established.']);
    ws.onclose = () => setLogs((prev) => [...prev, 'WebSocket connection closed.']);
    ws.onerror = (error) => console.error('WebSocket error:', error);

    setWebSocket(ws);
  };

  const handleSetup = async () => {
    await setupArena();
    setLogs((prev) => [...prev, 'Arena setup completed!']);
    setRounds([]);
  };

  const handleStart = async () => {
    const response = await startMatch();
    setLogs((prev) => [...prev, 'Match started!']);
    if (response) {
      setRounds([response]);
    }
    connectWebSocket();
  };

  const handleExecuteRound = async () => {
    const response = await executeRound();
    setLogs((prev) => [...prev, `Round executed`]);
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
      <h1 className="text-3xl font-bold mb-4">Arena Control Panel</h1>

      {/* Control Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={handleSetup}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded text-lg"
        >
          Setup Arena
        </button>
        <button
          onClick={handleStart}
          className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded text-lg"
        >
          Start Match
        </button>
        <button
          onClick={handleExecuteRound}
          className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded text-lg"
        >
          Execute Round
        </button>
      </div>

      {/* Match Logs */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">System Logs</h2>
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div key={index} className="text-gray-300 border-l-4 border-gray-700 pl-4 py-1">
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* Rounds Display */}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Match History</h2>
        <div className="space-y-8">
          {rounds.map((round, index) => (
            <div key={index} className="p-6 bg-gray-800 rounded-lg shadow-lg mb-8">
              <h3 className="text-xl font-bold mb-4">Round {round.round_number}</h3>
              
              {/* Public Messages */}
              {round.responses && (
                <div className="mb-4">
                  <h4 className="text-lg font-semibold mb-2">Messages:</h4>
                  {Object.entries(round.responses).map(([character, message]) => (
                    <div key={character} className="mb-2">
                      <span className="font-bold capitalize">{character}:</span> {String(message)}
                    </div>
                  ))}
                </div>
              )}

              {/* Judge Response */}
              {round.judge_response && (
                <div className="mb-4">
                  <h4 className="text-lg font-semibold mb-2">Judge Feedback:</h4>
                  <div className="whitespace-pre-wrap">{round.judge_response}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
