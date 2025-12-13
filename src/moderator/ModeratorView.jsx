import React, { useEffect, useState, useRef } from 'react';
import { gameApi } from '../api/gameApi';
import TopBar from './TopBar/TopBar';
import ConnectionDropdown from './ConnectionDropdown/ConnectionDropdown';
import LobbyLayout from './Lobby/LobbyLayout';
import GameArena from './GameArena/GameArena';
import GameStartLoadingScreen from './GameArena/GameStartLoadingScreen';
import DevMultiPlayerTool from './DevMultiPlayerTool/DevMultiPlayerTool';
import NightResultsStories from '../player/components/NightResultsStories/NightResultsStories';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [gameReadyForLoadingScreen, setGameReadyForLoadingScreen] = useState(false);
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:62',message:'Phase change tracking',data:{currentPhase,previousPhase,showGameStartLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Initialize previousPhase on first load
      if (previousPhase === null) {
        previousPhaseRef.current = currentPhase;
        return;
      }

      // If transitioning from lobby to night/day, show loading screen
      if (previousPhase === 'lobby' && (currentPhase === 'night' || currentPhase === 'day')) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:74',message:'Setting showGameStartLoading to true',data:{previousPhase,currentPhase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        setShowGameStartLoading(true);
        // Game is ready when phase changes from lobby to night/day
        setGameReadyForLoadingScreen(true);
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

  const startGame = async (finalRoleConfig, modifierConfig, timers, roleConfiguration) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:145',message:'startGame called',data:{gameId,hasFinalRoleConfig:!!finalRoleConfig,hasRoleConfiguration:!!roleConfiguration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      await gameApi.startGameWithConfig(gameId, finalRoleConfig, modifierConfig, timers, roleConfiguration);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:148',message:'startGameWithConfig completed, fetching state',data:{gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      await fetchGameState();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:149',message:'fetchGameState completed after startGame',data:{gameId,currentPhase:gameState?.game?.phase,hasRoleConfig:!!gameState?.game?.roleConfiguration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      return true;
    } catch (error) {
      console.error('Chyba při startu hry:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:151',message:'startGame error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
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

  // Handle return to menu - show confirmation modal first
  const handleReturnToMenuClick = () => {
    setShowConfirmModal(true);
  };

  // Actually return to menu - end lobby (kick all players) and delete game from database
  const handleReturnToMenu = async () => {
    setShowConfirmModal(false);
    
    if (gameId) {
      try {
        console.log('🚪 Ending lobby and kicking all players...');
        const result = await gameApi.endLobby(gameId);
        console.log(`✅ Lobby ended: ${result.playersKicked || 0} players kicked, game deleted`);
      } catch (error) {
        // Log error but don't block return to menu
        console.error('⚠️ Failed to end lobby:', error);
        // Fallback to regular delete if end-lobby fails
        try {
          await gameApi.deleteGame(gameId);
          console.log('✅ Game deleted (fallback)');
        } catch (deleteError) {
          console.error('⚠️ Failed to delete game (fallback):', deleteError);
        }
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:267',message:'Rendering GameStartLoadingScreen',data:{showGameStartLoading,gameReadyForLoadingScreen,currentPhase:gameState?.game?.phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return (
      <GameStartLoadingScreen 
        gameName={gameState?.game?.name}
        onComplete={() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ModeratorView.jsx:271',message:'GameStartLoadingScreen onComplete called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          setShowGameStartLoading(false);
          setGameReadyForLoadingScreen(false);
        }}
        onGameReady={gameReadyForLoadingScreen}
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
          onReturnToMenu={handleReturnToMenuClick}
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

      {/* Confirmation Modal for Return to Menu */}
      {showConfirmModal && (
        <ConfirmModal
          title="End Lobby?"
          message="All players will be disconnected and the lobby will be deleted."
          confirmText="End Lobby"
          cancelText="Cancel"
          onConfirm={handleReturnToMenu}
          onCancel={() => setShowConfirmModal(false)}
          isDanger={true}
        />
      )}
    </div>
  );
}

export default ModeratorView;
