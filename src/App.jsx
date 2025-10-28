import React, { useEffect, useState } from 'react';
import ModeratorView from './moderator/ModeratorView';
import PlayerView from './components/PlayerView';
import './App.css';

function App() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    
    if (modeParam === 'moderator') {
      setMode('moderator');
    } else {
      // Automaticky nastavit hráčský režim pokud není moderátor
      setMode('player');
    }
  }, []);

  if (!mode) {
    return <div className="loading">Načítání...</div>;
  }

  return (
    <div className="App">
      {mode === 'moderator' ? <ModeratorView /> : <PlayerView />}
    </div>
  );
}

export default App;
