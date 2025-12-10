// src/player/PlayerView.jsx

import React, { useEffect, useState } from 'react';
import { gameApi } from '../api/gameApi';
import { v4 as uuidv4 } from 'uuid';
import LoginScreen from './components/LoginScreen/LoginScreen';
import GameScreen from './components/GameScreen/GameScreen';
import './PlayerView.css';

function PlayerView() {
  const [step, setStep] = useState('login');
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [sessionId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('sessionId');
    
    if (urlSessionId) {
      console.log('🆔 Using sessionId from URL:', urlSessionId);
      return urlSessionId;
    }

    const urlRoomCode = urlParams.get('room');
    const forceNew = urlParams.get('newSession');
    const storageKey = `sessionId_${urlRoomCode || 'default'}`;
    
    if (forceNew === '1') {
      const newId = uuidv4();
      console.log('🆔 TEST MODE: Created NEW session:', newId);
      localStorage.setItem(storageKey, newId);
      return newId;
    }

    let sid = localStorage.getItem(storageKey);
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem(storageKey, sid);
      console.log('🆔 Created NEW session:', sid);
    } else {
      console.log('🆔 Using EXISTING session:', sid);
    }

    return sid;
  });

  // Auto-join z URL parametrů
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomCode = urlParams.get('room');
    const urlPlayerName = urlParams.get('playerName');
    
    if (urlRoomCode) {
      setRoomCode(urlRoomCode);
      console.log('🔑 Room code z URL:', urlRoomCode);
    }

    if (urlPlayerName) {
      setPlayerName(urlPlayerName);
      console.log('👤 Player name z URL:', urlPlayerName);
    }
  }, []);

  // Automatické přihlášení z URL
  useEffect(() => {
    if (playerName && roomCode && step === 'login' && !loading) {
      console.log('🤖 Auto-login z URL');
      console.log('  SessionId:', sessionId);
      performLogin(playerName, roomCode);
    }
  }, [playerName, roomCode, step, loading]);

  // Polling game state
  useEffect(() => {
    if (!gameId || !playerId) return;
    
    console.log('🔄 Starting game state polling with playerId:', playerId);
    
    const interval = setInterval(async () => {
      try {
        const data = await gameApi.getGameState(gameId);
        setGameState(data);
      } catch (err) {
        console.error('❌ Error polling game state:', err);
      }
    }, 2000);

    // Initial fetch
    fetchGameState();

    return () => clearInterval(interval);
  }, [gameId, playerId]);

  const performLogin = async (name, room) => {
    if (!name.trim() || !room.trim()) {
      setError('Chybí jméno nebo room kód');
      return;
    }

    if (room.length !== 4 || !/^\d+$/.test(room)) {
      setError('Room kód musí být 4 číslice');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      console.log('🚪 Joining:', { room, name, sessionId });
      const result = await gameApi.joinGameByCode(room, name, sessionId);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      console.log('✅ Připojen!', { gameId: result.gameId, playerId: result.playerId });
      
      setGameId(result.gameId);
      setPlayerId(result.playerId);
      setStep('playing');
      setError('');
      setLoading(false);
      
      await fetchGameState();
    } catch (err) {
      setError('Nepodařilo se připojit.');
      console.error(err);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await performLogin(playerName, roomCode);
  };

  const fetchGameState = async () => {
    if (!gameId) return;
    
    try {
      const data = await gameApi.getGameState(gameId);
      setGameState(data);
    } catch (error) {
      console.error('Chyba při načítání stavu:', error);
    }
  };

  // ✅ UPDATED: Support actionMode parameter for dual-action roles and Witch control
  const handleNightAction = async (targetData, actionMode = null) => {
    try {
      console.log('🌙 Night action:', { playerId, targetData, actionMode });
      
      // Pokud je targetData objekt s puppetId a targetId (Witch), použij ho
      // Jinak je to normální targetId
      const targetId = targetData?.targetId || targetData;
      const puppetId = targetData?.puppetId || null;
      
      await gameApi.setNightAction(gameId, playerId, targetId, actionMode, puppetId);
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při noční akci:', error);
      setError(error.message);
    }
  };

  const handleVote = async (targetId) => {
    try {
      await gameApi.vote(gameId, playerId, targetId);
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při hlasování:', error);
      setError(error.message);
    }
  };

  if (step === 'login') {
    return (
      <LoginScreen 
        playerName={playerName}
        roomCode={roomCode}
        loading={loading}
        error={error}
        onPlayerNameChange={setPlayerName}
        onRoomCodeChange={setRoomCode}
        onLogin={handleLogin}
      />
    );
  }

  if (!gameState) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Načítání hry...</p>
      </div>
    );
  }

  // ✅ Find current player
  const currentPlayer = gameState.players.find(p => p._id === playerId);
  
  if (!currentPlayer) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Načítání tvého profilu...</p>
      </div>
    );
  }

  // ✅ Pass currentPlayer to GameScreen
  return (
    <GameScreen 
      gameState={gameState}
      currentPlayer={currentPlayer}
      playerName={currentPlayer.name} // ✅ Explicitly pass player name
      playerId={playerId}
      gameId={gameId}
      onNightAction={handleNightAction}
      onVote={handleVote}
      error={error}
      onRefresh={fetchGameState}
    />
  );
}

export default PlayerView;
