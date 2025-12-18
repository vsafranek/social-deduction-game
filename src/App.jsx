import React, { useEffect, useState, useRef } from 'react';
import AppLoadingScreen from './components/AppLoadingScreen/AppLoadingScreen';
import GameStartLoadingScreen from './moderator/GameArena/GameStartLoadingScreen';
import MainMenu from './components/MainMenu/MainMenu';
import ModeratorView from './moderator/ModeratorView';
import PlayerView from './player/PlayerView';
import ConfirmDialog from './components/ConfirmDialog/ConfirmDialog';
import { GAME_NAME } from './config/gameConfig';
import './App.css';

function CreatingGameView({ onReturnToMenu, onSettings }) {
  const [gameReady, setGameReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const gameReadyRef = useRef(false);
  
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
          gameName={GAME_NAME}
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

  // Detect mobile device and handle resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Check URL parameters for direct mode access (for player view)
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const roomParam = params.get('room');
    
    // Auto-switch to player view if room parameter is present (even without mode=player)
    if (modeParam === 'player' || roomParam) {
      // Player view - skip menu and loading screen
      setCurrentView('player');
      setIsLoading(false);
    }
    // For null or 'moderator' mode param, show loading screen then menu
    // Loading will be handled by AppLoadingScreen
  }, []);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  const handleCreateGame = () => {
    setCurrentView('creating-game');
  };

  const handleJoinGame = () => {
    // Switch to player view for joining game (will show LoginScreen)
    setCurrentView('player');
    setIsLoading(false);
  };

  const handleSettings = () => {
    // Placeholder - will be implemented later
    alert('Settings will be available soon');
  };

  const handleExit = () => {
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    // In Electron, close the window
    if (window.electronAPI) {
      window.electronAPI.closeApp();
    } else {
      // In browser, close the tab/window
      window.close();
    }
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  const handleReturnToMenu = () => {
    setCurrentView('menu');
  };

  // Render content based on current view
  const renderContent = () => {
    if (isLoading) {
      return <AppLoadingScreen onComplete={handleLoadingComplete} />;
    }

    // Player view bypasses menu
    if (currentView === 'player') {
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
            isMobile={isMobile}
            isElectron={isElectron}
          />
        </div>
      );
    }

    // Creating game loading screen - also handles moderator view after loading
    if (currentView === 'creating-game' || currentView === 'moderator') {
      return (
        <CreatingGameView 
          onReturnToMenu={handleReturnToMenu}
          onSettings={handleSettings}
        />
      );
    }

    // Fallback (should not render)
    return <div>Unknown view state</div>;
  };

  return (
    <>
      {renderContent()}
      {showExitConfirm && (
        <ConfirmDialog
          title="Exit Game"
          message="Are you sure you want to exit the game?"
          onConfirm={handleExitConfirm}
          onCancel={handleExitCancel}
          confirmText="Exit"
          cancelText="Cancel"
        />
      )}
    </>
  );
}

export default App;
