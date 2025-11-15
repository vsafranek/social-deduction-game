// src/player/components/DayPhase/DayPhase.jsx
import React from 'react';
import './DayPhase.css';

function DayPhase({ onOpenVoting, hasVoted, votedPlayerName }) {
  if (hasVoted && votedPlayerName) {
    return (
      <div className="day-phase">
        <div className="vote-confirmed">
          <span>✅</span>
          <p>Hlasoval jsi pro <strong>{votedPlayerName}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <div className="day-phase">
      <button className="vote-button" onClick={onOpenVoting}>
        🗳️ Hlasovat pro vyloučení
      </button>
    </div>
  );
}

export default DayPhase;
