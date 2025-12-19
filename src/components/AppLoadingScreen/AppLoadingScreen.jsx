// src/components/AppLoadingScreen/AppLoadingScreen.jsx
import React, { useEffect, useState } from 'react';
import { GAME_NAME } from '../../config/gameConfig';
import './AppLoadingScreen.css';

function AppLoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Inicializace...');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        setStatus('Připojování k databázi...');
        
        // Check health endpoint to verify server and DB are ready
        const healthResponse = await fetch('/api/health');
        if (!healthResponse.ok) {
          throw new Error('Health check failed');
        }
        
        setStatus('Databáze připojena');
        setProgress(100);
        
        // Wait a bit before completing
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 500);
      } catch (error) {
        console.error('Connection error:', error);
        setStatus('Chyba připojení. Zkus to znovu.');
        // Still complete after delay to show menu (user can retry)
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 2000);
      }
    };

    // Simulate loading progress
    const duration = 1500; // 1.5 seconds
    const interval = 50;
    const increment = 90 / (duration / interval); // Go to 90%, then wait for DB check

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + increment, 90);
        return next;
      });
    }, interval);

    // Start DB check after initial progress
    const dbCheckTimeout = setTimeout(() => {
      clearInterval(timer);
      checkConnection();
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(dbCheckTimeout);
    };
  }, [onComplete]);

  return (
    <div className="app-loading-screen">
      <div className="loading-content">
        <div className="game-title">
          {GAME_NAME.split('').map((char, index) => (
            <span 
              key={index} 
              className="title-letter"
              style={{ 
                animationDelay: `${index * 0.05}s`,
                display: char === ' ' ? 'inline' : 'inline-block'
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>
        
        <div className="loading-bar-container">
          <div 
            className="loading-bar" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="loading-status">{status}</div>
      </div>
    </div>
  );
}

export default AppLoadingScreen;



