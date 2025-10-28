import React from 'react';
import './EventPanel.css';

function EventPanel({ players, logs }) {
  const aliveGood = players.filter(p => p.alive && ['Doktor','Policie','Vyšetřovatel','Pozorovatel','Pastičkář','Stopař','Občan'].includes(p.role)).length;
  const aliveEvil = players.filter(p => p.alive && ['Vrah','Uklízeč','Falšovač'].includes(p.role)).length;

  return (
    <div className="side-panel">
      <div className="panel-header">
        <h3>📜 Historie Událostí</h3>
      </div>
      <div className="panel-content">
        <div className="event-log">
          {logs.length === 0 ? (
            <div className="log-empty">Žádné události</div>
          ) : (
            logs.slice(-10).reverse().map((log, i) => (
              <div key={i} className="event-entry">
                <span className="event-bullet">•</span>
                <span className="event-text">{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="panel-footer">
        <div className="quick-stats">
          <div className="stat-box good">
            <span className="stat-label">Dobří</span>
            <span className="stat-value">{aliveGood}</span>
          </div>
          <div className="stat-box evil">
            <span className="stat-label">Zloduši</span>
            <span className="stat-value">{aliveEvil}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventPanel;
