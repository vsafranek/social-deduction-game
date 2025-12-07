// src/components/moderator/GameArena/FloatingLogDock.jsx
import React, { useState, useRef, useEffect } from 'react';
import './FloatingLogDock.css';

function FloatingLogDock({ logs, players }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  const prevLogsLengthRef = useRef(logs.length);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (open && logs.length > prevLogsLengthRef.current && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length, open]);

  // Helper function to get icon for log type
  const getLogIcon = (logMessage) => {
    if (logMessage.includes('Victory') || logMessage.includes('🏁')) return '🏆';
    if (logMessage.includes('Round') || logMessage.includes('DAY') || logMessage.includes('NIGHT')) return '⏰';
    if (logMessage.includes('voted') || logMessage.includes('Hlasoval')) return '🗳️';
    if (logMessage.includes('executed') || logMessage.includes('vyloučen')) return '⚔️';
    if (logMessage.includes('Mayor') || logMessage.includes('starosta')) return '🏛️';
    if (logMessage.includes('killed') || logMessage.includes('zabit')) return '💀';
    if (logMessage.includes('joined')) return '👋';
    if (logMessage.includes('reset')) return '🔄';
    return '📝';
  };

  // Helper function to format timestamp
  const formatTimestamp = (createdAt) => {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <button
        className={`fab-log ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={open ? 'Skrýt log' : 'Zobrazit log'}
        aria-label={open ? 'Skrýt log' : 'Zobrazit log'}
      >
        {open ? '×' : '📜'}
      </button>

      <div className={`log-sheet ${open ? 'visible' : ''}`}>
        <div className="sheet-header">
          <h3>📜 Historie událostí</h3>
          <button 
            className="close-btn"
            onClick={() => setOpen(false)}
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
        <div className="sheet-content" ref={contentRef}>
          {logs.length === 0 ? (
            <div className="log-empty">
              <div className="empty-icon">📋</div>
              <div className="empty-text">Žádné události</div>
              <div className="empty-subtext">Události se zobrazí zde</div>
            </div>
          ) : (
            logs.slice(-30).map((log, i) => {
              // Handle both string (legacy) and object (new) log formats
              const logMessage = typeof log === 'string' 
                ? log 
                : (log?.message || 'Neznámá událost');
              const logCreatedAt = typeof log === 'string' ? null : log?.createdAt;
              const logId = typeof log === 'string' ? `log-${i}` : (log?._id || `log-${i}`);
              
              // Ensure logMessage is a string before calling string methods
              const safeLogMessage = String(logMessage || '');
              const icon = getLogIcon(safeLogMessage);
              const isImportant = safeLogMessage.includes('Victory') || safeLogMessage.includes('🏁') || safeLogMessage.includes('Round');
              
              return (
                <div key={logId} className={`event-row ${isImportant ? 'important' : ''}`}>
                  <span className="event-icon">{icon}</span>
                  <span className="event-text">{safeLogMessage}</span>
                  {logCreatedAt && (
                    <span className="event-time">{formatTimestamp(logCreatedAt)}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export default FloatingLogDock;
