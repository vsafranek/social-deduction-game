// src/player/components/NightResultsStories/NightResultsStories.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import RoleIcon from '../../../components/icons/RoleIcon';
import { ROLE_INFO } from '../../../data/roleInfo';
import { RESULT_MAPPING } from '../NightResults/resultMapping';
import './NightResultsStories.css';

const STORY_DURATION = 6000;

function NightResultsStories({ results = [], onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const pausedTimeRef = useRef(0);

  const visibleResults = useMemo(() => {
    return results.filter((r) => {
      if (r === null || r === undefined) {
        return false;
      }
      const type = typeof r === 'string' ? r.split(':')[0] : r?.type;
      return type !== 'drunk';
    });
  }, [results]);

  const goToNext = useCallback(() => {
    if (currentIndex < visibleResults.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
    } else {
      onComplete();
    }
  }, [currentIndex, visibleResults.length, onComplete]);

  useEffect(() => {
    if (visibleResults.length === 0) {
      onComplete();
    }
  }, [visibleResults.length, onComplete]);

  useEffect(() => {
    if (currentIndex >= visibleResults.length) {
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
  }, [currentIndex, isPaused, visibleResults.length, onComplete, goToNext]);

  if (visibleResults.length === 0) {
    return null;
  }

  const parseResult = (r) => {
    if (typeof r === 'string') {
      const [type, ...detailParts] = r.split(':');
      return { type, detail: detailParts.join(':') };
    }
    return r;
  };

  // Parse investigation/autopsy/consig result to extract player name and roles
  const parseInvestigationResult = (detail) => {
    if (!detail) return null;
    
    // Format options:
    // 1. "PlayerName = Role1 / Role2" (Investigator)
    // 2. "PlayerName = Role (X)" (Consigliere)
    // 3. "PlayerName = Role" (Autopsy)
    
    let playerName = '';
    let rolesStr = '';
    
    // Try "PlayerName = ..." format first (Investigator, Autopsy, Consigliere)
    let match = detail.match(/^(.+?)\s*=\s*(.+?)(?:\s*\([^)]*\))?$/);
    if (match) {
      playerName = match[1].trim();
      rolesStr = match[2].trim();
    } else {
      // Try "PlayerName je Role (zbývá X)" format (legacy Consigliere)
      match = detail.match(/^(.+?)\s+je\s+(.+?)(?:\s*\(|$)/);
      if (match) {
        playerName = match[1].trim();
        rolesStr = match[2].trim();
      }
    }
    
    if (!playerName || !rolesStr) return null;
    
    // Split by "/" for multiple roles (Investigator shows 2 possibilities)
    const roles = rolesStr.split('/').map(r => r.trim());
    
    return { playerName, roles };
  };

  const currentResult = parseResult(visibleResults[currentIndex]);
  const eventData = RESULT_MAPPING[currentResult.type] || RESULT_MAPPING['safe'];
  
  // ✅ Rozhodnutí o zobrazení detailů
  const shouldShowDetail = !eventData.hideDetails && currentResult.detail;
  const subtitle = shouldShowDetail ? currentResult.detail : eventData.subtitle;
  
  // Check if this is an investigation-like result (investigate, consig, autopsy)
  const shouldShowRoleIcons = ['investigate', 'consig', 'autopsy'].includes(currentResult.type);
  const investigationData = shouldShowRoleIcons ? parseInvestigationResult(currentResult.detail) : null;

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
        {visibleResults.map((_, idx) => (
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
          {investigationData ? (
            <div className="investigation-story-result">
              <p className="investigated-player-story">{investigationData.playerName}</p>
              <div className="investigation-roles-story">
                {investigationData.roles.map((role, roleIdx) => {
                  const roleTeam = ROLE_INFO[role]?.team || 'neutral';
                  return (
                    <div key={roleIdx} className={`investigation-role-story-item team-${roleTeam}`}>
                      <RoleIcon role={role} size={48} useDetails={true} />
                      <span className="role-name-story">{role}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p>{subtitle}</p>
          )}
        </div>

        {/* Counter */}
        <div className="story-counter">
          {currentIndex + 1} / {visibleResults.length}
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
