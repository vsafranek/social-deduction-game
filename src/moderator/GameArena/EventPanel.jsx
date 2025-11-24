import React from 'react';
import './EventPanel.css';

function EventPanel({ players, logs }) {
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
            logs.slice(-10).reverse().map((log, i) => {
              // Handle both string (legacy) and object (new) log formats
              const logMessage = typeof log === 'string' 
                ? log 
                : (log?.message || 'Neznámá událost');
              const logId = typeof log === 'string' ? `log-${i}` : (log?._id || `log-${i}`);
              
              // Ensure logMessage is a string
              const safeLogMessage = String(logMessage || '');
              
              return (
                <div key={logId} className="event-entry">
                  <span className="event-bullet">•</span>
                  <span className="event-text">{safeLogMessage}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default EventPanel;
