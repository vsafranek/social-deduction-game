// src/player/PlayerView.jsx
import React, { useEffect, useState } from 'react';
import { gameApi } from '../api/gameApi';
import { v4 as uuidv4 } from 'uuid';

function PlayerView() {
  const [step, setStep] = useState('login');
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  
  // HYBRIDNÍ ŘEŠENÍ: Reconnect + testování
  const [sessionId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
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
      console.log('🆔 Using EXISTING session (reconnect):', sid);
    }
    return sid;
  });

  const [playerId, setPlayerId] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ Auto-join z URL parametrů (pro dev hráče)
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

  // ✅ Automatické přihlášení, pokud máme room code a jméno z URL
  useEffect(() => {
    if (playerName && roomCode && step === 'login' && !loading) {
      console.log('🤖 Auto-login z URL:', { roomCode, playerName });
      performLogin(playerName, roomCode);
    }
  }, [playerName, roomCode]);

  useEffect(() => {
    if (gameId && playerId) {
      console.log('🔄 Starting polling for player:', playerId);
      const interval = setInterval(fetchGameState, 2000);
      fetchGameState();
      return () => clearInterval(interval);
    }
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
      console.log('🚪 Joining with:', { room, name, sessionId });
      const result = await gameApi.joinGameByCode(room, name, sessionId);
      
      console.log('Join result:', result);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      console.log('✅ Připojen! GameId:', result.gameId, 'PlayerId:', result.playerId);
      
      // Uložit sessionId pro tento room code
      localStorage.setItem(`sessionId_${room}`, sessionId);
      setGameId(result.gameId);
      setPlayerId(result.playerId);
      setStep('playing');
      setError('');
      setLoading(false);
      
      await fetchGameState();
    } catch (err) {
      setError('Nepodařilo se připojit. Zkontroluj room kód a připojení.');
      console.error(err);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // Manuální login
    if (!playerName.trim()) {
      setError('Zadej své jméno');
      return;
    }
    if (!roomCode.trim()) {
      setError('Zadej room kód');
      return;
    }

    await performLogin(playerName, roomCode);
  };

  const fetchGameState = async () => {
    if (!gameId) return;
    try {
      const data = await gameApi.getGameState(gameId);
      setGameState(data);
      if (data.game.phase !== 'lobby' && !myRole) {
        const roleData = await gameApi.getPlayerRole(gameId, sessionId);
        setMyRole(roleData.role);
      }
    } catch (error) {
      console.error('Chyba při načítání stavu:', error);
    }
  };

  const performNightAction = async (targetId) => {
    const action = myRole === 'Šerif' ? 'investigate' : myRole === 'Doktor' ? 'heal' : myRole === 'Mafián' ? 'kill' : null;
    if (!action || !playerId) return;
    try {
      await gameApi.nightAction(gameId, playerId, targetId, action);
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při noční akci:', error);
    }
  };

  const vote = async (targetId) => {
    if (!playerId) return;
    try {
      await gameApi.vote(gameId, playerId, targetId);
      await fetchGameState();
    } catch (error) {
      console.error('Chyba při hlasování:', error);
    }
  };

  // Login screen
  if (step === 'login') {
    return (
      <div className="player-login">
        <h2>🎮 Připoj se ke hře</h2>
        <p>Zadej room kód a své jméno</p>

        <input
          type="text"
          placeholder="Room kód (4 číslice)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          disabled={loading}
          maxLength="4"
        />

        <input
          type="text"
          placeholder="Tvoje jméno"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          disabled={loading}
        />

        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Připojuji...' : '✅ Připojit se'}
        </button>

        {error && <div className="error">{error}</div>}

        <small>Tip: Ujisti se že jsi na stejné WiFi síti jako moderátor</small>
        <small>SessionId: {sessionId.substring(0, 12)}...</small>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="player-loading">
        <div className="spinner"></div>
        <p>Načítání hry...</p>
      </div>
    );
  }

  const aliveCount = gameState.players.filter(p => p.alive).length;

  // Playing screen
  return (
    <div className="player-view">
      <h1>{playerName}</h1>
      
      <div className="game-info">
        <p><strong>Fáze:</strong> {gameState.game.phase}</p>
        <p><strong>Připojeno hráčů:</strong> {gameState.players.length}</p>
        <p><strong>Živých hráčů:</strong> {aliveCount}</p>
        {myRole && <p><strong>Tvá role:</strong> {myRole}</p>}
      </div>

      {gameState.game.phase === 'night' && myRole && (
        <div className="night-actions">
          <h3>{myRole === 'Šerif' && '🔍 Vyber hráče k vyšetření'}
                {myRole === 'Doktor' && '💉 Vyber hráče k zachránění'}
                {myRole === 'Mafián' && '🔪 Vyber oběť k zabití'}</h3>
          
          <div className="players-list">
            {gameState.players.map(player => (
              <button 
                key={player._id}
                onClick={() => performNightAction(player._id)}
                disabled={!player.alive}
                className={`player-button ${player.alive ? 'alive' : 'dead'}`}
              >
                {player.name} {player.alive ? '✅' : '💀'}
              </button>
            ))}
          </div>
          <p>✅ Akce provedena</p>
        </div>
      )}

      {gameState.game.phase === 'day' && (
        <div className="day-voting">
          <h3>🗳️ Hlasuj o tom, kdo bude popraven</h3>
          
          <div className="players-list">
            {gameState.players.map(player => (
              <button 
                key={player._id}
                onClick={() => vote(player._id)}
                disabled={!player.alive}
                className={`player-button ${player.alive ? 'alive' : 'dead'}`}
              >
                {player.name} {player.alive ? '✅' : '💀'}
              </button>
            ))}
          </div>
          <p>✅ Hlasoval jsi</p>
        </div>
      )}

      {gameState.game.phase === 'spectator' && (
        <div className="spectator">
          <p>Sleduj zbývající hru jako divák</p>
          <p>Zkontroluj hlavní obrazovku pro výsledky</p>
        </div>
      )}
    </div>
  );
}

export default PlayerView;
