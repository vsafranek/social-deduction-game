import React, { useEffect, useState } from 'react';
import { gameApi } from '../api/gameApi';
import TopBar from './TopBar/TopBar';
import ConnectionDropdown from './ConnectionDropdown/ConnectionDropdown';
import LobbyLayout from './Lobby/LobbyLayout';
import GameArena from './GameArena/GameArena';
import DevMultiPlayerTool from './DevMultiPlayerTool/DevMultiPlayerTool';
import NightResultsStories from '../player/components/NightResultsStories/NightResultsStories';
import './ModeratorView.css';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

const TEST_STORIES_DATA = [
  'killed:Testovací Hráč',
  'attacked:Neznámý Útočník',
  'healed:Byl jsi zachráněn',
  'blocked:Policista tě zablokoval',
  'trapped:Spadl jsi do pasti',
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

function ModeratorView() {
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConnectionBox, setShowConnectionBox] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showTestStories, setShowTestStories] = useState(false);

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

  const initializeGame = async () => {
    try {
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
      setLoading(false);
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

  if (loading || !gameState) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Vytvářím hru...</p>
      </div>
    );
  }

  const isInLobby = gameState?.game?.phase === 'lobby';

  return (
    <div className="moderator-view">
      {/* TopBar - pouze v lobby */}
      {isInLobby && (
        <TopBar 
          gameState={gameState} 
          onConnectionClick={() => setShowConnectionBox(!showConnectionBox)}
          onDevToggle={setShowDevPanel}
          onTestStories={IS_DEVELOPMENT ? () => setShowTestStories(true) : undefined}
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
