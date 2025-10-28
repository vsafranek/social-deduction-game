import React from 'react';
import './CenterCircle.css';

function CenterCircle({ phase, round, aliveCount, countdownSec }) {
  return (
    <div className="center-circle">
      <div className="center-info">
        <div className="phase-display">
          {phase === 'night' && '🌙'}
          {phase === 'day' && '☀️'}
          {phase === 'end' && '🏁'}
        </div>
        <div className="round-display">Kolo {round}</div>
        <div className="alive-count">{aliveCount} živých</div>
      </div>

      <div className="center-controls">
       <div className="countdown">
            {Number.isInteger(countdownSec) ? `${countdownSec}s` : '—'}
        </div>
        {phase === 'end' && (
          <div className="game-over-center">
            <h3>Hra skončila!</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default CenterCircle;
