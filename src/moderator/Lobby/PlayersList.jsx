import React from 'react';
import './PlayersList.css';

function PlayersList({
  players,
  availableRoles,
  assignedRoles,
  onAssignRole,
  onUnassignRole,
  onStartGame
}) {
  const getRoleTeam = (role) => availableRoles[role]?.team || 'good';
  const getEmoji = (role) => availableRoles[role]?.emoji || '❓';

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
              <div className="player-info">
                <span className="player-name">{p.name}</span>
                {assignedRoles[p._id] && (
                  <span className={`assigned-role ${getRoleTeam(assignedRoles[p._id])}`}>
                    {getEmoji(assignedRoles[p._id])} {assignedRoles[p._id]}
                  </span>
                )}
              </div>

              {assignedRoles[p._id] ? (
                <button className="btn-unassign" onClick={() => onUnassignRole(p._id)}>
                  ✕
                </button>
              ) : (
                <select
                  className="role-select"
                  onChange={(e) => onAssignRole(p._id, e.target.value)}
                  value=""
                >
                  <option value="">Automaticky</option>
                  {Object.keys(availableRoles).map(role => (
                    <option key={role} value={role}>
                      {getEmoji(role)} {role}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="column-footer">
        <button 
          className="btn-start-game"
          onClick={onStartGame}
          disabled={players.length < 3}
        >
          {players.length < 3 
            ? `⏳ Minimálně 3 hráči (${players.length}/3)`
            : '▶️ Spustit Hru'
          }
        </button>
      </div>
    </div>
  );
}

export default PlayersList;
