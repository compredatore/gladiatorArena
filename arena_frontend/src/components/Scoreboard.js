import React from 'react';

const Scoreboard = ({ scores }) => (
  <div>
    <h3>Current Scores</h3>
    <ul>
      {Object.entries(scores).map(([model, score]) => (
        <li key={model}>{model}: {score}</li>
      ))}
    </ul>
  </div>
);

export default Scoreboard;
