import React, { useEffect, useState } from 'react';
import { gameApi } from '../api/gameApi';
import TopBar from './TopBar/TopBar';
import ConnectionDropdown from './ConnectionDropdown/ConnectionDropdown';
import LobbyLayout from './Lobby/LobbyLayout';
import GameArena from './GameArena/GameArena';
import './ModeratorView.css';

function ModeratorView() {
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConnectionBox, setShowConnectionBox] = useState(false);

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

  const startGame = async (finalRoleConfig, modifierConfig) => {
    try {
      await gameApi.startGameWithConfig(gameId, finalRoleConfig, modifierConfig);
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při startu hry:', error);
      alert(error.message || 'Nepodařilo se spustit hru');
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
      <div className="loading-screen">
        <h2>❌ Chyba</h2>
        <p>{error}</p>
        <button onClick={initializeGame}>Zkusit znovu</button>
      </div>
    );
  }

  if (loading || !connectionInfo) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <h2>Připravuji hru...</h2>
        <p>Vytvářím novou hru...</p>
      </div>
    );
  }

  return (
    <div className="moderator-view">
      <TopBar 
        gameState={gameState}
        onConnectionClick={() => setShowConnectionBox(!showConnectionBox)}
      />
      
      {showConnectionBox && (
        <ConnectionDropdown 
          connectionInfo={connectionInfo}
          onClose={() => setShowConnectionBox(false)}
        />
      )}

      {gameState && (
        <>
          {gameState.game.phase === 'lobby' ? (
            <LobbyLayout 
              gameState={gameState}
              onStartGame={startGame}
            />
          ) : (
            <GameArena 
              gameState={gameState}
              onEndNight={endNight}
              onEndDay={endDay}
            />
          )}
        </>
      )}
    </div>
  );
}

export default ModeratorView;
