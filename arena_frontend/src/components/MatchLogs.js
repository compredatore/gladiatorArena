import React from 'react';

const MatchLogs = ({ logs }) => (
  <div style={{ maxHeight: '300px', overflowY: 'scroll', border: '1px solid black', padding: '10px' }}>
    {logs.map((log, index) => (
      <div key={index}>
        {log.round && <p><strong>Round {log.round}:</strong></p>}
        <p>Model A: {log.model_a_said}</p>
        <p>Model B: {log.model_b_said}</p>
        <hr />
      </div>
    ))}
  </div>
);

export default MatchLogs;
