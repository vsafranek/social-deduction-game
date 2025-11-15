// src/utils/DevMultiPlayerTool.jsx
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { gameApi } from '../../api/gameApi';
import './DevMultiPlayerTool.css';

const RANDOM_NAMES = [
  'Petr', 'Jana', 'Tomáš', 'Eva', 'Lukáš', 
  'Karolína', 'Martin', 'Veronika', 'David', 'Tereza',
  'Jakub', 'Markéta', 'Filip', 'Kristýna', 'Ondřej',
  'Michal', 'Barbora', 'Adam', 'Natálie', 'Vojtěch'
];

function DevMultiPlayerTool({ roomCode, onPlayersConnected, isVisible = true }) {
  const [playerCount, setPlayerCount] = useState(3);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [error, setError] = useState('');
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment || !roomCode || !isVisible) return null;

  const generateRandomName = (usedNames) => {
    const availableNames = RANDOM_NAMES.filter(name => !usedNames.includes(name));
    if (availableNames.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableNames.length);
      return availableNames[randomIndex];
    }
    return `Hráč${Math.floor(Math.random() * 10000)}`;
  };

  const openPlayerWindow = async (playerName, sessionId) => {
  try {
    if (window.electronAPI) {
      // ✅ Předej sessionId do player window
      await window.electronAPI.createPlayerWindow(playerName, roomCode, sessionId);
      console.log(`🪟 Otevřeno okno pro hráče: ${playerName} (session: ${sessionId.substring(0, 12)}...)`);
    }
  } catch (error) {
    console.error('Chyba při otevírání okna:', error);
    setError(`Chyba: ${error.message}`);
  }
};

const connectMultiplePlayers = async () => {
  setIsConnecting(true);
  setError('');
  const newPlayers = [];
  const usedNames = [...connectedPlayers.map(p => p.name)];

  try {
    for (let i = 0; i < playerCount; i++) {
      const playerName = generateRandomName(usedNames);
      usedNames.push(playerName);
      
      // ✅ Vytvoř unikátní sessionId PRO KAŽDÉHO hráče
      const sessionId = `dev_${uuidv4()}`;
      
      console.log(`🎮 Připojuji hráče ${i + 1}/${playerCount}: ${playerName}`);
      console.log(`   SessionId: ${sessionId}`);
      
      const result = await gameApi.joinGameByCode(roomCode, playerName, sessionId);
      
      if (result.success) {
        newPlayers.push({
          name: playerName,
          sessionId,
          playerId: result.playerId,
          gameId: result.gameId
        });
        console.log(`✅ ${playerName} připojen (PlayerId: ${result.playerId})`);
        
        // ✅ Otevři okno S unikátním sessionId
        await new Promise(resolve => setTimeout(resolve, 300));
        await openPlayerWindow(playerName, sessionId);
      } else {
        console.error(`❌ Chyba při připojení ${playerName}:`, result.error);
        setError(`❌ ${playerName}: ${result.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    setConnectedPlayers(prev => [...prev, ...newPlayers]);
    
    if (onPlayersConnected) {
      onPlayersConnected(newPlayers);
    }
    
    console.log(`✅ Úspěšně připojeno ${newPlayers.length} hráčů`);
    
  } catch (err) {
    console.error('❌ Chyba při připojování hráčů:', err);
    setError(`Chyba: ${err.message}`);
  } finally {
    setIsConnecting(false);
  }
};


  const closeAllWindows = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.closeAllPlayerWindows();
        console.log('🧹 Všechna okna zavřena');
      }
    } catch (error) {
      console.error('Chyba při zavírání oken:', error);
    }
  };

  const disconnectAll = () => {
    closeAllWindows();
    setConnectedPlayers([]);
    console.log('🧹 Dev hráči resetováni');
  };

  return (
    <div className="dev-multiplayer-tool">
      <div className="dev-tool-header">
        🛠️ DEV: Multi-Player Tool
      </div>
      
      <div className="dev-tool-content">
        <div className="info-row">
          <span className="info-label">Room:</span>
          <span className="info-value">{roomCode}</span>
        </div>
        
        <div className="info-row">
          <span className="info-label">Připojeno:</span>
          <span className="info-value">{connectedPlayers.length} hráčů</span>
        </div>

        <div className="control-row">
          <label>
            Počet nových hráčů:
            <input 
              type="number" 
              min="1" 
              max="15" 
              value={playerCount}
              onChange={(e) => setPlayerCount(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
              disabled={isConnecting}
            />
          </label>
        </div>
        
        <div className="button-row">
          <button 
            onClick={connectMultiplePlayers}
            disabled={isConnecting || !roomCode}
            className="connect-button"
          >
            {isConnecting ? '⏳ Připojování...' : `🎮 Připojit + 🪟 Okna`}
          </button>
          
          {connectedPlayers.length > 0 && (
            <button 
              onClick={disconnectAll}
              disabled={isConnecting}
              className="reset-button"
            >
              🧹
            </button>
          )}
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {connectedPlayers.length > 0 && (
          <details className="players-list">
            <summary>Hráči ({connectedPlayers.length})</summary>
            <div className="players-chips">
              {connectedPlayers.map((player, idx) => (
                <span key={idx} className="player-chip">
                  {player.name}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default DevMultiPlayerTool;