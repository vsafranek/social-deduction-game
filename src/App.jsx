import React, { useEffect, useState, useRef } from 'react';
import AppLoadingScreen from './components/AppLoadingScreen/AppLoadingScreen';
import GameStartLoadingScreen from './moderator/GameArena/GameStartLoadingScreen';
import MainMenu from './components/MainMenu/MainMenu';
import ModeratorView from './moderator/ModeratorView';
import PlayerView from './player/PlayerView';
import './App.css';

function CreatingGameView({ onReturnToMenu, onSettings }) {
  const [gameReady, setGameReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const gameReadyRef = React.useRef(false);
  
  const handleGameReady = () => {
    if (!gameReadyRef.current) {
      gameReadyRef.current = true;
      setGameReady(true);
    }
  };
  
  const handleLoadingComplete = () => {
    setShowLoading(false);
  };
  
  return (
    <div className="App">
      {showLoading && (
        <GameStartLoadingScreen 
          gameName="Social Deduction Game"
          onComplete={handleLoadingComplete}
          onGameReady={gameReady}
        />
      )}
      <ModeratorView 
        onReturnToMenu={onReturnToMenu} 
        onGameReady={handleGameReady}
        showLoadingScreen={!showLoading}
        onSettings={onSettings}
      />
    </div>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'moderator', 'player', 'creating-game'
  const [mode, setMode] = useState(null);

  useEffect(() => {
    // Check URL parameters for direct mode access (for player view)
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    
    if (modeParam === 'player' || modeParam === null) {
      // Player view - skip menu and loading screen
      setMode('player');
      setCurrentView('player');
      setIsLoading(false);
    } else if (modeParam === 'moderator') {
      // Moderator mode - show loading screen, then menu
      setMode('moderator');
      // Loading will be handled by AppLoadingScreen
    }
  }, []);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  const handleCreateGame = () => {
    setCurrentView('creating-game');
  };

  const handleJoinGame = () => {
    // Placeholder - will be implemented later
    alert('Funkce připojení k hře bude brzy dostupná');
  };

  const handleSettings = () => {
    // Placeholder - will be implemented later
    alert('Nastavení bude brzy dostupné');
  };

  const handleExit = () => {
    if (window.confirm('Opravdu chceš ukončit aplikaci?')) {
      // In Electron, close the window
      if (window.electronAPI) {
        window.electronAPI.closeApp();
      } else {
        // In browser, just show message
        alert('Aplikaci lze ukončit zavřením okna nebo záložky.');
      }
    }
  };

  const handleReturnToMenu = () => {
    setCurrentView('menu');
  };

  if (isLoading) {
    return <AppLoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Player view bypasses menu
  if (currentView === 'player' || mode === 'player') {
    return (
      <div className="App">
        <PlayerView />
      </div>
    );
  }

  // Main menu
  if (currentView === 'menu') {
    return (
      <div className="App">
        <MainMenu 
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          onSettings={handleSettings}
          onExit={handleExit}
        />
      </div>
    );
  }

  // Creating game loading screen - also handles moderator view after loading
  if (currentView === 'creating-game' || currentView === 'moderator') {
    return <CreatingGameView 
      onReturnToMenu={handleReturnToMenu}
      onSettings={handleSettings}
    />;
  }

  return null;
}

export default App;
