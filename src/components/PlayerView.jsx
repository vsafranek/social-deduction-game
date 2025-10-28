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

  useEffect(() => {
    // Zkus načíst room code z URL (pokud přišel přes link)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomCode = urlParams.get('room');
    
    if (urlRoomCode) {
      setRoomCode(urlRoomCode);
      console.log('🔑 Room code z URL:', urlRoomCode);
    }
  }, []);

  useEffect(() => {
    if (gameId && playerId) {
      console.log('🔄 Starting polling for player:', playerId);
      const interval = setInterval(fetchGameState, 2000);
      fetchGameState();
      return () => clearInterval(interval);
    }
  }, [gameId, playerId]);

  const handleLogin = async () => {
    // Validace
    if (!playerName.trim()) {
      setError('Zadej své jméno');
      return;
    }
    
    if (!roomCode.trim()) {
      setError('Zadej room kód');
      return;
    }
    
    if (roomCode.length !== 4 || !/^\d+$/.test(roomCode)) {
      setError('Room kód musí být 4 číslice');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      console.log('🚪 Joining with:', { roomCode, playerName, sessionId });
      
      const result = await gameApi.joinGameByCode(roomCode, playerName, sessionId);
      console.log('Join result:', result);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      
      console.log('✅ Připojen! GameId:', result.gameId, 'PlayerId:', result.playerId);
      
      // Uložit sessionId pro tento room code
      localStorage.setItem(`sessionId_${roomCode}`, sessionId);
      
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
    const action = myRole === 'Šerif' ? 'investigate' : 
                   myRole === 'Doktor' ? 'heal' : 
                   myRole === 'Mafián' ? 'kill' : null;
    
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
        <h1>🎮 Připoj se do hry</h1>
        <p className="welcome-text">Zadej room kód a své jméno</p>
        
        <div className="login-form">
          {/* Room Code Input */}
          <div className="form-group">
            <label htmlFor="roomCode">Room Kód</label>
            <input
              id="roomCode"
              type="text"
              placeholder="4 číslice (např. 1234)"
              value={roomCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setRoomCode(value);
              }}
              maxLength={4}
              disabled={loading}
              autoFocus={!roomCode}
              className="room-code-input"
              style={{
                fontSize: '1.5rem',
                letterSpacing: '0.5rem',
                textAlign: 'center',
                fontFamily: 'monospace'
              }}
            />
          </div>
          
          {/* Player Name Input */}
          <div className="form-group">
            <label htmlFor="playerName">Tvé Jméno</label>
            <input
              id="playerName"
              type="text"
              placeholder="Zadej své jméno"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              maxLength={20}
              disabled={loading}
              autoFocus={roomCode.length === 4}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            onClick={handleLogin}
            className="btn-connect"
            disabled={!playerName.trim() || !roomCode.trim() || loading}
          >
            {loading ? 'Připojuji se...' : '🚀 Vstoupit do hry'}
          </button>
        </div>
        
        <div className="help-section">
          <h3>💡 Jak se připojit?</h3>
          <ol>
            <li>Získej <strong>room kód</strong> od moderátora (4 číslice)</li>
            <li>Zadej room kód výše</li>
            <li>Zadej své jméno</li>
            <li>Klikni "Vstoupit do hry"</li>
          </ol>
          
          <div style={{marginTop: '20px', padding: '10px', background: 'rgba(0,212,255,0.1)', borderRadius: '8px'}}>
            <p style={{fontSize: '0.9rem', margin: 0}}>
              💡 <strong>Tip:</strong> Ujisti se že jsi na stejné WiFi síti jako moderátor
            </p>
          </div>
          
          {/* Debug info */}
          <details style={{marginTop: '20px', fontSize: '0.85rem', opacity: 0.7}}>
            <summary style={{cursor: 'pointer'}}>🔧 Info pro vývojáře</summary>
            <p style={{marginTop: '10px', wordBreak: 'break-all'}}>
              SessionId: {sessionId.substring(0, 12)}...
            </p>
          </details>
        </div>
      </div>
    );
  }

  // Loading
  if (!gameState) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Načítání hry...</p>
      </div>
    );
  }

  const me = gameState.players.find(p => p._id === playerId);
  const canAct = me && me.alive;

  return (
    <div className="player-view">
      <div className="player-header">
        <h1>👤 {playerName}</h1>
        <h2>🎭 {myRole || 'Čekám na start...'}</h2>
        <div className="phase-indicator">
          Fáze: <span className={`phase ${gameState.game.phase}`}>
            {gameState.game.phase.toUpperCase()}
          </span>
        </div>
      </div>

      {gameState.game.phase === 'lobby' && (
        <div className="waiting">
          <h2>⏳ Čekáme na start hry...</h2>
          <p>Připojeno hráčů: <strong>{gameState.players.length}</strong></p>
          <div className="player-list">
            {gameState.players.map(p => (
              <span key={p._id} className="player-badge">{p.name}</span>
            ))}
          </div>
        </div>
      )}

      {gameState.game.phase === 'night' && canAct && myRole !== 'Občan' && (
        <div className="night-actions">
          <h2>🌙 Noční Akce</h2>
          <p className="role-description">
            {myRole === 'Šerif' && '🔍 Vyber hráče k vyšetření'}
            {myRole === 'Doktor' && '💉 Vyber hráče k zachránění'}
            {myRole === 'Mafián' && '🔪 Vyber oběť k zabití'}
          </p>
          
          <div className="target-list">
            {gameState.players
              .filter(p => p._id !== playerId && p.alive)
              .map(player => (
                <button
                  key={player._id}
                  onClick={() => performNightAction(player._id)}
                  disabled={me.nightAction?.targetId !== null}
                  className="target-button"
                >
                  {player.name}
                </button>
              ))}
          </div>
          
          {me.nightAction?.targetId && (
            <p className="action-done">✅ Akce provedena</p>
          )}
        </div>
      )}

      {gameState.game.phase === 'night' && (myRole === 'Občan' || !canAct) && (
        <div className="waiting">
          <h2>🌙 Je noc...</h2>
          <p>Ostatní provádějí své akce. Vyčkej na rozhodnutí moderátora.</p>
        </div>
      )}

      {gameState.game.phase === 'day' && canAct && (
        <div className="day-voting">
          <h2>☀️ Denní Hlasování</h2>
          <p>Hlasuj o tom, kdo bude popraven</p>
          
          <div className="target-list">
            {gameState.players
              .filter(p => p._id !== playerId && p.alive)
              .map(player => (
                <button
                  key={player._id}
                  onClick={() => vote(player._id)}
                  disabled={me.hasVoted}
                  className="target-button"
                >
                  {player.name}
                </button>
              ))}
          </div>
          
          {me.hasVoted && (
            <p className="action-done">✅ Hlasoval jsi</p>
          )}
        </div>
      )}

      {!canAct && gameState.game.phase !== 'lobby' && gameState.game.phase !== 'end' && (
        <div className="dead-screen">
          <h2>💀 Jsi mrtvý</h2>
          <p>Sleduj zbývající hru jako divák</p>
        </div>
      )}

      {gameState.game.phase === 'end' && (
        <div className="game-over">
          <h2>🏁 Hra Skončila!</h2>
          <p>Zkontroluj hlavní obrazovku pro výsledky</p>
        </div>
      )}

      <div className="alive-players">
        <h3>👥 Živí Hráči ({gameState.players.filter(p => p.alive).length}):</h3>
        <div className="player-chips">
          {gameState.players.filter(p => p.alive).map(p => (
            <span key={p._id} className="player-chip">{p.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlayerView;
