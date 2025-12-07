// src/player/components/NightResults/NightResults.jsx
import React, { useEffect, useState } from 'react';
import './NightResults.css';

const RESULT_MAPPING = {
  'killed': { 
    emoji: '💀', 
    label: 'Zavražděn', 
    bgGradient: 'linear-gradient(135deg, #dc2626, #991b1b)', 
    severity: 'critical' 
  },
  'attacked': { 
    emoji: '⚔️', 
    label: 'Útok', 
    bgGradient: 'linear-gradient(135deg, #f97316, #ea580c)', 
    severity: 'critical' 
  },
  'healed': { 
    emoji: '💚', 
    label: 'Zachráněn', 
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)', 
    severity: 'positive' 
  },
  'protected': { 
    emoji: '🛡️', 
    label: 'Chráněn', 
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)', 
    severity: 'positive' 
  },
  'blocked': { 
    emoji: '👮', 
    label: 'Uzamčen', 
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
    severity: 'neutral' 
  },
  'guarded': { 
    emoji: '🛡️', 
    label: 'Zastaven stráží', 
    bgGradient: 'linear-gradient(135deg, #f59e0b, #d97706)', 
    severity: 'negative' 
  },
  'drunk': { 
    emoji: '🍺', 
    label: 'Opilý', 
    bgGradient: 'linear-gradient(135deg, #f59e0b, #d97706)', 
    severity: 'negative' 
  },
  'success': { 
    emoji: '✅', 
    label: 'Úspěch', 
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)', 
    severity: 'positive' 
  },
  'visited': { 
    emoji: '👤', 
    label: 'Návštěva', 
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
    severity: 'neutral' 
  },
  'watch': { 
    emoji: '👁️', 
    label: 'Pozorování', 
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
    severity: 'neutral' 
  },
  'track': { 
    emoji: '👣', 
    label: 'Sledování', 
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
    severity: 'neutral' 
  },
  'investigate': { 
    emoji: '🔍', 
    label: 'Vyšetřování', 
    bgGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
    severity: 'neutral' 
  },
  'autopsy': { 
    emoji: '🔬', 
    label: 'Pitva', 
    bgGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 
    severity: 'info' 
  },
  'safe': { 
    emoji: '😴', 
    label: 'Klidná noc', 
    bgGradient: 'linear-gradient(135deg, #22c55e, #16a34a)', 
    severity: 'positive' 
  },
  'protect': { 
    emoji: '💉', 
    label: 'Ochrana', 
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)', 
    severity: 'neutral' 
  },
  'insomniac': { 
    emoji: '😵', 
    label: 'Nespavost', 
    bgGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 
    severity: 'info' 
  },
  'consig': { 
    emoji: '🕵️', 
    label: 'Vyšetřování', 
    bgGradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)', 
    severity: 'info' 
  },
  'hunter_success': { 
    emoji: '🏹', 
    label: 'Úspěch', 
    bgGradient: 'linear-gradient(135deg, #10b981, #059669)', 
    severity: 'success' 
  },
  'hunter_guilt': { 
    emoji: '💀', 
    label: 'Výčitky', 
    bgGradient: 'linear-gradient(135deg, #dc2626, #991b1b)', 
    severity: 'critical' 
  }
};

function NightResults({ player, results = [] }) {
  const [displayedResults, setDisplayedResults] = useState([]);
  const [lastResultsStr, setLastResultsStr] = useState('');
  const [expanded, setExpanded] = useState(true);
  const canSeeVisitorNames = player?.modifier === 'Insomniac';

  const formatDetail = (result) => {
    if (!result?.detail) return null;

    if (result.type === 'visited' && !canSeeVisitorNames) {
      const names = result.detail
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
      const count = names.length;

      if (count === 0) {
        return 'Někdo tě pravděpodobně navštívil.';
      }

      if (count === 1) {
        return 'Někdo tě navštívil (detaily skryté).';
      }

      return `${count} hráčů tě navštívilo (detaily skryté).`;
    }

    return result.detail;
  };

  useEffect(() => {
    if (!results || results.length === 0) {
      setDisplayedResults([]);
      return;
    }

    const resultsStr = JSON.stringify(results);
    if (resultsStr === lastResultsStr) {
      return;
    }

    setLastResultsStr(resultsStr);
    setDisplayedResults([]);

    const parsed = results.map(r => {
      if (typeof r === 'string') {
        const [type, ...detailParts] = r.split(':');
        return { type, detail: detailParts.join(':') };
      }
      return r;
    });

    // Postupné zobrazení
    parsed.forEach((result, idx) => {
      setTimeout(() => {
        setDisplayedResults(prev => [...prev, result]);
      }, idx * 200);
    });
  }, [results, lastResultsStr, player]);

  if (displayedResults.length === 0) {
    return null;
  }

  // Zjisti nejvýznamnější výsledek pro summary
  const getMostImportant = () => {
    const priorities = { critical: 0, negative: 1, positive: 2, neutral: 3, info: 4 };
    let mostImportant = displayedResults[0];
    let lowestPriority = 10;

    displayedResults.forEach(result => {
      const eventData = RESULT_MAPPING[result.type] || RESULT_MAPPING['safe'];
      const priority = priorities[eventData.severity] || 3;
      
      if (priority < lowestPriority) {
        lowestPriority = priority;
        mostImportant = result;
      }
    });

    return mostImportant;
  };

  const mainResult = getMostImportant();
  const mainEventData = RESULT_MAPPING[mainResult.type] || RESULT_MAPPING['safe'];
  const mainDetail = formatDetail(mainResult);
  
  // Zobraz rozklikávací šipku pouze pokud je více výsledků (pak je co rozbalit)
  const shouldShowExpand = displayedResults.length > 1;
  const isClickable = shouldShowExpand;

  return (
    <div className="night-results-container">
      {/* Main summary card */}
      <div 
        className={`night-result-summary ${mainEventData.severity} ${isClickable ? 'clickable' : ''}`}
        style={{ background: mainEventData.bgGradient }}
        onClick={isClickable ? () => setExpanded(!expanded) : undefined}
      >
        <div className="result-summary-content">
          <span className="result-emoji">{mainEventData.emoji}</span>
          <div className="result-text">
            <span className="result-label">{mainEventData.label}</span>
            {mainDetail && (
              <span className="result-detail">{mainDetail}</span>
            )}
          </div>
          {shouldShowExpand && (
            <button className="expand-btn">
              {expanded ? '▼' : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* Detailed results */}
      {expanded && displayedResults.length > 1 && (
        <div className="night-results-details">
          {displayedResults.map((result, idx) => {
            const eventData = RESULT_MAPPING[result.type] || RESULT_MAPPING['safe'];
            
            return (
              <div 
                key={idx}
                className={`night-result-item ${eventData.severity}`}
                style={{ 
                  background: eventData.bgGradient,
                  animationDelay: `${idx * 0.1}s`
                }}
              >
                <span className="result-emoji-small">{eventData.emoji}</span>
                <div className="result-item-text">
                  <span className="result-label-small">{eventData.label}</span>
                  {formatDetail(result) && (
                    <span className="result-detail-small">{formatDetail(result)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NightResults;
