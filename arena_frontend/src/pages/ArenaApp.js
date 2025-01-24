import React, { useState, useEffect } from 'react';
import MatchLogs from '../components/MatchLogs';
import Scoreboard from '../components/Scoreboard';
import Comments from '../components/Comments';
import { fetchArenaSetup, startMatch, executeRound } from '../utils/api';

const ArenaApp = () => {
  const [models, setModels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [scores, setScores] = useState({});
  const [selectedModels, setSelectedModels] = useState({ modelA: '', modelB: '' });
  const [comments, setComments] = useState([]);
  const [isMatchStarted, setIsMatchStarted] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      const data = await fetchArenaSetup();
      setModels(Object.keys(data.models));
    };
    loadModels();
  }, []);

  const handleStartMatch = async () => {
    const data = await startMatch(selectedModels.modelA, selectedModels.modelB);
    setLogs(data.logs);
    setIsMatchStarted(true);
  };

  const handleExecuteRound = async () => {
    const data = await executeRound();
    if (data.message.includes('Match finished')) {
      alert(`Match finished! Winner: ${data.winner}`);
      setIsMatchStarted(false);
    } else {
      setLogs((prev) => [...prev, ...data.logs]);
      setScores(data.current_scores);
    }
  };

  return (
    <div>
      <h1>LLM Gladiator Arena</h1>
      {!isMatchStarted && (
        <div>
          <label>
            Model A:
            <select onChange={(e) => setSelectedModels({ ...selectedModels, modelA: e.target.value })}>
              <option value="">Select Model</option>
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
          <label>
            Model B:
            <select onChange={(e) => setSelectedModels({ ...selectedModels, modelB: e.target.value })}>
              <option value="">Select Model</option>
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
          <button onClick={handleStartMatch}>Start Match</button>
        </div>
      )}
      {isMatchStarted && (
        <>
          <MatchLogs logs={logs} />
          <Scoreboard scores={scores} />
          <button onClick={handleExecuteRound}>Execute Round</button>
        </>
      )}
      <Comments comments={comments} onSubmit={(comment) => setComments((prev) => [...prev, comment])} />
    </div>
  );
};

export default ArenaApp;
