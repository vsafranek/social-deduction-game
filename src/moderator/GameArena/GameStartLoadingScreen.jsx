// src/moderator/GameArena/GameStartLoadingScreen.jsx
import React, { useEffect, useState, useRef } from 'react';
import './GameStartLoadingScreen.css';

const GAME_NAME = 'Social Deduction Game';

function GameStartLoadingScreen({ gameName, onComplete, onGameReady }) {
  const displayName = gameName || GAME_NAME;
  const [progress, setProgress] = useState(0);
  const completionTimerRef = useRef(null);
  const initialProgressTimerRef = useRef(null);

  // Initial progress animation up to 90%
  useEffect(() => {
    if (onGameReady) return; // Don't start if game is already ready
    
    const duration = 1500; // 1.5 seconds to reach 90%
    const interval = 50; // Update every 50ms
    const increment = 90 / (duration / interval);

    initialProgressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return 90;
        }
        return Math.min(prev + increment, 90);
      });
    }, interval);

    return () => {
      if (initialProgressTimerRef.current) {
        clearInterval(initialProgressTimerRef.current);
      }
    };
  }, [onGameReady]);

  // When game is ready, complete the progress bar and transition
  useEffect(() => {
    if (onGameReady && !completionTimerRef.current) {
      // Clear initial progress timer
      if (initialProgressTimerRef.current) {
        clearInterval(initialProgressTimerRef.current);
        initialProgressTimerRef.current = null;
      }
      
      // Ensure we start from at least 90%
      setProgress((prev) => Math.max(prev, 90));
      
      // Complete progress bar quickly
      completionTimerRef.current = setInterval(() => {
        setProgress((current) => {
          if (current >= 100) {
            if (completionTimerRef.current) {
              clearInterval(completionTimerRef.current);
              completionTimerRef.current = null;
            }
            // Wait a bit before calling onComplete for smooth transition
            setTimeout(() => {
              if (onComplete) onComplete();
            }, 300);
            return 100;
          }
          return Math.min(current + 5, 100);
        });
      }, 30);
    }

    return () => {
      if (completionTimerRef.current) {
        clearInterval(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, [onGameReady, onComplete]);

  return (
    <div className="game-start-loading-screen">
      <div className="loading-content">
        <div className="game-title">
          {displayName.split('').map((char, index) => (
            <span 
              key={index} 
              className="title-letter"
              style={{ 
                animationDelay: `${index * 0.1}s`,
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
        
        <div className="loading-text">
          <span className="loading-dots">
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default GameStartLoadingScreen;


