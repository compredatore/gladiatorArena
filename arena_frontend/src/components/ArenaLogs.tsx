import React, { useEffect, useState } from 'react';
import { createWebSocketConnection } from '../services/websocket';

const ArenaLogs: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const socket = createWebSocketConnection((data) => {
      setLogs((prevLogs) => [...prevLogs, data]);
    });

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div>
      <h2>Arena Logs</h2>
      <div style={{ maxHeight: '300px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default ArenaLogs;
