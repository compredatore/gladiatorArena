import React from 'react';
import AdminPanel from './components/AdminPanel';
import ArenaLogs from './components/ArenaLogs';

const App: React.FC = () => {
  return (
    <div>
      <AdminPanel />
      <ArenaLogs />
    </div>
  );
};

export default App;
