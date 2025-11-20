// src/player/components/NightResultsStories/NightResultsStories.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './NightResultsStories.css';

const RESULT_MAPPING = {
  'killed': { 
    emoji: '💀', 
    label: 'Byl jsi zavražděn', 
    subtitle: 'Někdo tě zabil v noci',
    bgGradient: 'linear-gradient(135deg, #dc2626, #991b1b)',
    hideDetails: true // ✅ Skryj jméno vraha
  },
  'attacked': { 
    emoji: '⚔️', 
    label: 'Útok!', 
    subtitle: 'Na tebe byl proveden útok',
    bgGradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    hideDetails: true
  },
  'healed': { 
    emoji: '💚', 
    label: 'Zachráněn!', 
    subtitle: 'Doktor odvrátil útok',
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)',
    hideDetails: false
  },
  'blocked': { 
    emoji: '👮', 
    label: 'Uzamčen', 
    subtitle: 'Nemohl jsi provést akci',
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    hideDetails: false
  },
  'trapped': { 
    emoji: '🪤', 
    label: 'Past!', 
    subtitle: 'Spadl jsi do pasti',
    bgGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    hideDetails: false
  },
  'drunk': { 
    emoji: '🍺', 
    label: 'Příliš opilý', 
    subtitle: 'Tvá akce selhala',
    bgGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    hideDetails: false
  },
  'success': { 
    emoji: '✅', 
    label: 'Úspěch!', 
    subtitle: 'detail', 
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)',
    hideDetails: false
  },
  'visited': { 
    emoji: '👤', 
    label: 'Návštěva', 
    subtitle: 'Někdo tě navštívil',
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    hideDetails: true // ✅ Skryj jména návštěvníků (pokud nemáš Lookout/Trapper)
  },
  'watch': { 
    emoji: '👁️', 
    label: 'Pozorování', 
    subtitle: 'detail', // Zobraz jména
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    hideDetails: false
  },
  'track': { 
    emoji: '👣', 
    label: 'Sledování', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    hideDetails: false
  },
  'investigate': { 
    emoji: '🔍', 
    label: 'Vyšetřování', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    hideDetails: false
  },
  'safe': { 
    emoji: '😴', 
    label: 'Klidná noc', 
    subtitle: 'Nic se ti nestalo',
    bgGradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    hideDetails: false
  },
  'protect': { 
    emoji: '💉', 
    label: 'Ochrana', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)',
    hideDetails: false
  },
  'insomniac': { 
    emoji: '😵', 
    label: 'Nespavost', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    hideDetails: false
  },
  'consig': { 
    emoji: '🕵️', 
    label: 'Vyšetřování', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    hideDetails: false
  },
  'hunter_success': { 
    emoji: '🏹', 
    label: 'Úspěšný lov', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)',
    hideDetails: false
  },
  'hunter_guilt': { 
    emoji: '💀', 
    label: 'Zemřel jsi', 
    subtitle: 'Zabil jsi nevinného',
    bgGradient: 'linear-gradient(135deg, #dc2626, #991b1b)',
    hideDetails: true
  },
  
 };

const STORY_DURATION = 6000;

function NightResultsStories({ results = [], onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const pausedTimeRef = useRef(0);

  const goToNext = useCallback(() => {
    if (currentIndex < results.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
    } else {
      onComplete();
    }
  }, [currentIndex, results.length, onComplete]);

  useEffect(() => {
    if (currentIndex >= results.length) {
      onComplete();
      return;
    }

    const updateProgress = () => {
      if (isPaused) {
        return;
      }

      const now = Date.now();
      const elapsed = now - startTimeRef.current - pausedTimeRef.current;
      const newProgress = (elapsed / STORY_DURATION) * 100;

      if (newProgress >= 100) {
        goToNext();
      } else {
        setProgress(newProgress);
      }
    };

    timerRef.current = setInterval(updateProgress, 16);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentIndex, isPaused, results.length, onComplete, goToNext]);

  if (results.length === 0) {
    return null;
  }

  const parseResult = (r) => {
    if (typeof r === 'string') {
      const [type, ...detailParts] = r.split(':');
      return { type, detail: detailParts.join(':') };
    }
    return r;
  };

  const currentResult = parseResult(results[currentIndex]);
  const eventData = RESULT_MAPPING[currentResult.type] || RESULT_MAPPING['safe'];
  
  // ✅ Rozhodnutí o zobrazení detailů
  const shouldShowDetail = !eventData.hideDetails && currentResult.detail;
  const subtitle = shouldShowDetail ? currentResult.detail : eventData.subtitle;

  const handleNext = () => {
    goToNext();
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handlePauseStart = () => {
    setIsPaused(true);
    pausedTimeRef.current = Date.now() - startTimeRef.current;
  };

  const handlePauseEnd = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now() - pausedTimeRef.current;
  };

  return (
    <div 
      className="stories-overlay"
      onMouseDown={handlePauseStart}
      onMouseUp={handlePauseEnd}
      onMouseLeave={handlePauseEnd}
      onTouchStart={handlePauseStart}
      onTouchEnd={handlePauseEnd}
    >
      {/* Progress bars */}
      <div className="stories-progress">
        {results.map((_, idx) => (
          <div key={idx} className="progress-bar-container">
            <div 
              className="progress-bar"
              style={{
                width: idx === currentIndex 
                  ? `${progress}%` 
                  : idx < currentIndex 
                    ? '100%' 
                    : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Story content */}
      <div 
        className="story-content"
        style={{ background: eventData.bgGradient }}
        key={currentIndex}
      >
        {/* Floating particles */}
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        {/* Main emoji */}
        <div className="story-emoji">
          {eventData.emoji}
        </div>

        {/* Text content */}
        <div className="story-text">
          <h2>{eventData.label}</h2>
          <p>{subtitle}</p>
        </div>

        {/* Counter */}
        <div className="story-counter">
          {currentIndex + 1} / {results.length}
        </div>
      </div>

      {/* Navigation zones */}
      <div className="story-nav-left" onClick={handlePrev} />
      <div className="story-nav-right" onClick={handleNext} />

      {/* Skip button */}
      <button className="story-skip" onClick={handleSkip}>
        Přeskočit ›
      </button>

      {/* Pause indicator */}
      {isPaused && (
        <div className="pause-indicator">
          <div className="pause-icon">⏸</div>
        </div>
      )}
    </div>
  );
}

export default NightResultsStories;
