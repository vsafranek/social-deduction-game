// src/components/moderator/GameArena/PhaseTransition.jsx
import React from 'react';
import './PhaseTransition.css';

function PhaseTransition({ from, to, hiding }) {
  const isNightToDay = from === 'night' && to === 'day';
  const isDayToNight = from === 'day' && to === 'night';

  return (
    <div className={`phase-transition ${to} ${hiding ? 'hiding' : ''}`}>
      <div className="transition-bg"></div>
      
      {isNightToDay && (
        <div className="light-burst"></div>
      )}
      
      {isDayToNight && (
        <>
          <div className="nightfall-particles"></div>
          <div className="darkness-veil"></div>
        </>
      )}
      
      <div className="transition-content">
        <div className="transition-icon">
          {to === 'day' ? (
            <img 
              src="/icons/general/day.svg" 
              alt="Day" 
              className="transition-icon-img"
            />
          ) : (
            <img 
              src="/icons/general/moon.svg" 
              alt="Night" 
              className="transition-icon-img"
            />
          )}
        </div>
        <div className="transition-text">
          {to === 'day' ? 'DAY BREAKS' : 'NIGHT FALLS'}
        </div>
        <div className="transition-subtitle">
          {to === 'day' ? 'Discuss and vote' : 'Use your abilities'}
        </div>
      </div>
    </div>
  );
}


export default PhaseTransition;
