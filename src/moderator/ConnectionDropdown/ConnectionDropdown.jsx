import React from 'react';
import './ConnectionDropdown.css';

function ConnectionDropdown({ connectionInfo, onClose }) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Copied!');
    });
  };

  return (
    <div className="connection-dropdown">
      <div className="connection-content">
        <h3>📱 Player Connection</h3>
        
        <div className="url-display" onClick={() => copyToClipboard(connectionInfo.url)}>
          {connectionInfo.url}
        </div>
        <small className="copy-hint">👆 Click to copy</small>
        
        <div className="connection-info">
          <div className="info-row">
            <span className="info-label">Room Code:</span>
            <span className="info-value">{connectionInfo.roomCode}</span>
          </div>
          <div className="info-row">
            <span className="info-label">IP:</span>
            <span className="info-value">{connectionInfo.ip}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Port:</span>
            <span className="info-value">{connectionInfo.port}</span>
          </div>
        </div>

        {isDevelopment && (
          <div className="dev-tools">
            <h4>🔧 Dev Tools</h4>
            <div className="dev-buttons">
              <button onClick={() => window.open(`${connectionInfo.url}&newSession=1`, '_blank')}>
                Test 1
              </button>
              <button onClick={() => window.open(`${connectionInfo.url}&newSession=1`, '_blank')}>
                Test 2
              </button>
              <button onClick={() => window.open(`${connectionInfo.url}&newSession=1`, '_blank')}>
                Test 3
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConnectionDropdown;
