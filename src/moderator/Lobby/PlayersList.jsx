import React from 'react';
import './PlayersList.css';

function PlayersList({
  players,
  availableRoles,
  assignedRoles,
  onAssignRole,
  onUnassignRole
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
    </div>
  );
}

export default PlayersList;
