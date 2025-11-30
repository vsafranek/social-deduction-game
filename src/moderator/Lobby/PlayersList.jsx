import React from 'react';
import { gameApi } from '../../api/gameApi';
import './PlayersList.css';

function PlayersList({
  players,
  gameId,
  onRefresh
}) {
  const handleKick = async (playerId, playerName) => {
    if (!window.confirm(`Opravdu chceš vyhodit hráče "${playerName}"?`)) {
      return;
    }

    try {
      await gameApi.kickPlayer(gameId, playerId);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Chyba při kicknutí hráče:', error);
      alert(error.message || 'Nepodařilo se vyhodit hráče');
    }
  };

  return (
    <div className="lobby-column players-column">
      <div className="column-header">
        <h2>👥 Hráči ({players.length})</h2>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <p>Žádní hráči</p>
          <small>Čekám na připojení...</small>
        </div>
      ) : (
        <div className="players-list">
          {players.map(p => (
            <div key={p._id} className="player-item">
              {p.avatar ? (
                <img 
                  src={p.avatar} 
                  alt={p.name}
                  className="player-avatar-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div 
                className="player-avatar-fallback"
                style={{ 
                  display: p.avatar ? 'none' : 'flex',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.1)',
                  fontSize: '20px',
                  flexShrink: 0
                }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="player-info">
                <span className="player-name">{p.name}</span>
              </div>
              <button
                className="btn-kick-player"
                onClick={() => handleKick(p._id, p.name)}
                title="Vyhodit hráče"
              >
                ❌
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlayersList;
