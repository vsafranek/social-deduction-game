// src/player/components/DayPhase/DayPhase.jsx
import React from 'react';
import './DayPhase.css';

function DayPhase({ onOpenVoting, hasVoted, votedPlayerName, isMayorElection = false }) {
  if (hasVoted) {
    if (votedPlayerName) {
      return (
        <div className="day-phase">
          <div className="vote-confirmed">
            <span>✅</span>
            <p>
              {isMayorElection 
                ? `Hlasoval jsi pro starostu: ${votedPlayerName}`
                : `Hlasoval jsi pro ${votedPlayerName}`
              }
            </p>
          </div>
        </div>
      );
    } else {
      // Hlasoval skip (přeskočit)
      return (
        <div className="day-phase">
          <div className="vote-confirmed">
            <span>⏭️</span>
            <p>Přeskočil jsi hlasování</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="day-phase">
      <button className="vote-button" onClick={onOpenVoting}>
        {isMayorElection ? '🏛️ Hlasovat pro starostu' : '🗳️ Hlasovat pro vyloučení'}
      </button>
    </div>
  );
}

export default DayPhase;
