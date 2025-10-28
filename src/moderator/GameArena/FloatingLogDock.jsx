// src/components/moderator/GameArena/FloatingLogDock.jsx
import React, { useState } from 'react';
import './FloatingLogDock.css';

function FloatingLogDock({ logs, players }) {
  const [open, setOpen] = useState(false);
  const aliveGood = players.filter(p => p.alive && ['Doktor','Policie','Vyšetřovatel','Pozorovatel','Pastičkář','Stopař','Občan'].includes(p.role)).length;
  const aliveEvil = players.filter(p => p.alive && ['Vrah','Uklízeč','Falšovač'].includes(p.role)).length;

  return (
    <>
      <button
        className={`fab-log ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={open ? 'Skrýt log' : 'Zobrazit log'}
      >
        {open ? '×' : '📜'}
      </button>

      <div className={`log-sheet ${open ? 'visible' : ''}`}>
        <div className="sheet-header">
          <h3>Historie</h3>
          <div className="quick-stats">
            <span className="qs good">🟢 {aliveGood}</span>
            <span className="qs evil">🔴 {aliveEvil}</span>
          </div>
        </div>
        <div className="sheet-content">
          {logs.length === 0 ? (
            <div className="log-empty">Žádné události</div>
          ) : (
            logs.slice(-25).reverse().map((log, i) => (
              <div key={i} className="event-row">
                <span className="dot">•</span>
                <span className="text">{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default FloatingLogDock;
