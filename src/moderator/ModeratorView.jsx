import React, { useEffect, useState, useRef } from 'react';
import { gameApi } from '../api/gameApi';
import TopBar from './TopBar/TopBar';
import ConnectionDropdown from './ConnectionDropdown/ConnectionDropdown';
import LobbyLayout from './Lobby/LobbyLayout';
import GameArena from './GameArena/GameArena';
import GameStartLoadingScreen from './GameArena/GameStartLoadingScreen';
import DevMultiPlayerTool from './DevMultiPlayerTool/DevMultiPlayerTool';
import NightResultsStories from '../player/components/NightResultsStories/NightResultsStories';
import './ModeratorView.css';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

const TEST_STORIES_DATA = [
  'killed:Testovací Hráč',
  'attacked:Neznámý Útočník',
  'healed:Byl jsi zachráněn',
  'blocked:Policista tě zablokoval',
  'guarded:Zastaven stráží',
  'success:Tvá akce byla úspěšná',
  'visited:Někdo tě navštívil',
  'watch:Viděl jsi: Hráč1, Hráč2',
  'track:Sledovaný šel k: Cíl',
  'investigate:Cíl je: MAFIA',
  'autopsy:Příčina smrti: Nůž',
  'safe:Klidná noc',
  'protect:Ochránil jsi cíl',
  'insomniac:Viděl jsi pohyb u: Hráč3',
  'consig:Role cíle je: DETEKTIV',
  'hunter_success:Zastřelil jsi vlkodlaka',
  'hunter_guilt:Zabil jsi nevinného'
];

function ModeratorView({ onReturnToMenu, onGameReady, showLoadingScreen = true, onSettings }) {
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConnectionBox, setShowConnectionBox] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showTestStories, setShowTestStories] = useState(false);
  const [showGameStartLoading, setShowGameStartLoading] = useState(false);
  const previousPhaseRef = useRef(null);
  const gameReadyNotifiedRef = useRef(false);

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (gameId) {
      fetchGameState();
      const interval = setInterval(fetchGameState, 2000);
      return () => clearInterval(interval);
    }
  }, [gameId]);

  // Track phase changes to show loading screen when transitioning from lobby to game
  useEffect(() => {
    if (gameState?.game) {
      const currentPhase = gameState.game.phase;
      const previousPhase = previousPhaseRef.current;

      // Initialize previousPhase on first load
      if (previousPhase === null) {
        previousPhaseRef.current = currentPhase;
        return;
      }

      // If transitioning from lobby to night/day, show loading screen
      if (previousPhase === 'lobby' && (currentPhase === 'night' || currentPhase === 'day')) {
        setShowGameStartLoading(true);
      }

      previousPhaseRef.current = currentPhase;
    }
  }, [gameState?.game?.phase]);

  // If game is ready and parent is showing loading screen, notify it to hide
  // This must be before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (!loading && gameState && !showLoadingScreen && onGameReady && !gameReadyNotifiedRef.current) {
      // Notify parent immediately that game is ready (only once)
      // The loading screen will handle the timing of when to hide
      gameReadyNotifiedRef.current = true;
      onGameReady();
    }
  }, [loading, gameState, showLoadingScreen, onGameReady]);

  const initializeGame = async () => {
    try {
      setLoading(true);
      const healthResponse = await fetch('/api/health');
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }
      const health = await healthResponse.json();
      const { ip, port } = health;
      
      const result = await gameApi.createGame(ip, port);
      if (result.error) {
        throw new Error(result.error);
      }
      
      setGameId(result.gameId);
      setConnectionInfo({
        ip,
        port,
        roomCode: result.roomCode,
        url: `http://${ip}:${port}?room=${result.roomCode}`
      });
      
      // Wait a moment for game to be created, then fetch state
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchGameState();
      setLoading(false);
      
      // Don't notify parent here - let useEffect handle it after state is set
    } catch (error) {
      console.error('❌ Chyba při vytváření hry:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchGameState = async () => {
    if (!gameId) return;
    try {
      const data = await gameApi.getGameState(gameId);
      setGameState(data);
    } catch (error) {
      console.error('❌ Chyba při načítání stavu:', error);
    }
  };

  const handleDevPlayersConnected = async (players) => {
    console.log('✅ Dev hráči připojeni:', players);
    await new Promise(resolve => setTimeout(resolve, 300));
    await fetchGameState();
  };

  const startGame = async (finalRoleConfig, modifierConfig, timers) => {
    try {
      await gameApi.startGameWithConfig(gameId, finalRoleConfig, modifierConfig, timers);
      await fetchGameState();
      return true;
    } catch (error) {
      console.error('Chyba při startu hry:', error);
      alert(error.message || 'Nepodařilo se spustit hru');
      return false;
    }
  };

  const endNight = async () => {
    try {
      await gameApi.endNight(gameId);
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při ukončení noci:', error);
    }
  };

  const endDay = async () => {
    try {
      const result = await gameApi.endDay(gameId);
      if (result.winner) {
        alert(result.winner === 'town' ? '🎉 Město vyhrálo!' : '🎉 Mafiáni vyhráli!');
      }
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při ukončení dne:', error);
    }
  };

  // Handle return to menu - delete game from database first
  const handleReturnToMenu = async () => {
    if (gameId) {
      try {
        console.log('🗑️ Deleting game from database before returning to menu...');
        await gameApi.deleteGame(gameId);
        console.log('✅ Game deleted successfully');
      } catch (error) {
        // Log error but don't block return to menu
        console.error('⚠️ Failed to delete game from database:', error);
      }
    }
    
    // Always call onReturnToMenu even if delete failed
    if (onReturnToMenu) {
      onReturnToMenu();
    }
  };

  // Cleanup: delete game when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup function runs when component unmounts
      if (gameId) {
        // Use async IIFE to handle async cleanup
        (async () => {
          try {
            console.log('🗑️ Cleaning up: deleting game from database on unmount...');
            await gameApi.deleteGame(gameId);
            console.log('✅ Game deleted successfully on unmount');
          } catch (error) {
            // Log error but don't throw (cleanup functions shouldn't throw)
            console.error('⚠️ Failed to delete game on unmount:', error);
          }
        })();
      }
    };
  }, [gameId]);

  if (error) {
    return (
      <div className="error-container">
        <h2>❌ Chyba</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Vytvářím novou hru...
        </button>
      </div>
    );
  }

  // Handle loading state
  // If parent is showing loading screen, don't render anything (parent handles display)
  // If parent is not showing loading screen and we're still loading, show our loading bar
  if (loading || !gameState) {
    // If parent is showing loading screen, render nothing
    if (!showLoadingScreen) {
      return null;
    }
    // If parent is NOT showing loading screen, show our own loading bar
    return (
      <div className="moderator-loading-container">
        <div className="moderator-loading-bar-container">
          <div className="moderator-loading-bar" />
        </div>
        <p className="moderator-loading-text">Načítání...</p>
      </div>
    );
  }
  
  // Game is loaded, show content

  const isInLobby = gameState?.game?.phase === 'lobby';

  // Show game start loading screen
  if (showGameStartLoading) {
    return (
      <GameStartLoadingScreen 
        gameName={gameState?.game?.name}
        onComplete={() => setShowGameStartLoading(false)}
      />
    );
  }

  return (
    <div className="moderator-view">
      {/* TopBar - pouze v lobby */}
      {isInLobby && (
        <TopBar 
          gameState={gameState} 
          onConnectionClick={() => setShowConnectionBox(!showConnectionBox)}
          onDevToggle={setShowDevPanel}
          onTestStories={IS_DEVELOPMENT ? () => setShowTestStories(true) : undefined}
          onReturnToMenu={handleReturnToMenu}
          onSettings={onSettings}
        />
      )}

      {showConnectionBox && (
        <ConnectionDropdown
          connectionInfo={connectionInfo}
          onClose={() => setShowConnectionBox(false)}
        />
      )}

      {/* DEV TOOL - zobrazí se pouze v dev módu a v lobby */}
      {isInLobby && (
        <DevMultiPlayerTool 
          roomCode={connectionInfo?.roomCode}
          onPlayersConnected={handleDevPlayersConnected}
          isVisible={showDevPanel}
        />
      )}

      {isInLobby ? (
        <LobbyLayout
          gameState={gameState}
          onStartGame={startGame}
          onRefresh={fetchGameState}
        />
      ) : (
        <GameArena
          gameState={gameState}
          onEndNight={endNight}
          onEndDay={endDay}
        />
      )}

      {/* Test Night Stories Overlay - development only */}
      {IS_DEVELOPMENT && showTestStories && (
        <NightResultsStories 
          results={TEST_STORIES_DATA}
          onComplete={() => setShowTestStories(false)}
        />
      )}
    </div>
  );
}

export default ModeratorView;
