// src/player/components/NightResultsStories/NightResultsStories.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import RoleIcon from '../../../components/icons/RoleIcon';
import { ROLE_INFO } from '../../../data/roleInfo';
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
  'autopsy': { 
    emoji: '🔬', 
    label: 'Pitva', 
    subtitle: 'detail',
    bgGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
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
                      <RoleIcon role={role} size={48} />
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
