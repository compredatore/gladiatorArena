import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const backendURL = "http://127.0.0.1:8000";

function App() {
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [logs, setLogs] = useState([]);
  const [stream, setStream] = useState("");
  const websocketRef = useRef(null);

  const setupArena = async () => {
    try {
      const response = await axios.post(`${backendURL}/arena/setup`);
      alert("Arena setup successful!");
    } catch (error) {
      alert("Error setting up the arena.");
    }
  };

  const startMatch = async () => {
    if (!modelA || !modelB) {
      alert("Please select both Model A and Model B.");
      return;
    }
    try {
      const response = await axios.post(`${backendURL}/arena/start`, {
        model_a: modelA,
        model_b: modelB,
      });
      setLogs(response.data.logs || []);
      alert("Match started!");
    } catch (error) {
      alert("Error starting the match.");
    }
  };

  const executeRound = async () => {
    try {
      if (!websocketRef.current) {
        websocketRef.current = new WebSocket(`${backendURL.replace("http", "ws")}/stream`);
        websocketRef.current.onmessage = (event) => {
          setStream((prevStream) => prevStream + event.data);
        };
      }
      const response = await axios.post(`${backendURL}/arena/round`);
      setLogs((prevLogs) => [...prevLogs, response.data.round_data]);
    } catch (error) {
      alert("Error executing the round.");
    }
  };

  return (
    <div className="container">
      <h1>Gladiator Arena Admin Panel</h1>
      <div>
        <label>Model A:</label>
        <input
          type="text"
          value={modelA}
          onChange={(e) => setModelA(e.target.value)}
          placeholder="Enter Model A (e.g., egg)"
        />
      </div>
      <div>
        <label>Model B:</label>
        <input
          type="text"
          value={modelB}
          onChange={(e) => setModelB(e.target.value)}
          placeholder="Enter Model B (e.g., santa)"
        />
      </div>
      <div style={{ marginTop: "20px" }}>
        <button onClick={setupArena}>Setup Arena</button>
        <button onClick={startMatch} style={{ marginLeft: "10px" }}>
          Start Match
        </button>
        <button onClick={executeRound} style={{ marginLeft: "10px" }}>
          Execute Round
        </button>
      </div>

      <h2>Live Stream</h2>
      <textarea value={stream} readOnly />

      <h2>Logs</h2>
      <div className="log-container">
        {logs.map((log, index) => (
          <div key={index}>
            <strong>Round {log.round}</strong>: {JSON.stringify(log)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
