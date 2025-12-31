import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './ConnectionDropdown.css';

function ConnectionDropdown({ connectionInfo, onClose }) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Copied!');
    });
  };

  // Determine web URL based on environment
  const webUrl = connectionInfo?.roomCode 
    ? (isDevelopment 
        ? `http://192.168.1.196:3001/?room=${connectionInfo.roomCode}`
        : `https://shadows-of-gloaming.vercel.app/?room=${connectionInfo.roomCode}`)
    : (isDevelopment 
        ? 'http://192.168.1.196:3001/'
        : 'https://shadows-of-gloaming.vercel.app/');

  return (
    <div className="connection-dropdown">
      <div className="connection-content">
        <h3>📱 Player Connection</h3>
        
        {/* Web URL Section */}
        <div className="web-url-section">
          <h4>🌐 Web Address</h4>
          <div className="url-display web-url" onClick={() => copyToClipboard(webUrl)}>
            {webUrl}
          </div>
          
          {/* QR Code */}
          <div className="qr-code-container">
            <QRCodeSVG
              value={webUrl}
              size={200}
              level="M"
              includeMargin={true}
            />
            <p className="qr-hint">📱 Scan with your phone to join</p>
          </div>
        </div>
        
        <div className="connection-info">
          <div className="info-row">
            <span className="info-label">Room Code:</span>
            <span className="info-value">{connectionInfo.roomCode}</span>
          </div>
          {isDevelopment && (
            <>
              <div className="info-row">
                <span className="info-label">Server:</span>
                <span className="info-value">http://192.168.1.196:3001</span>
              </div>
            </>
          )}
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
