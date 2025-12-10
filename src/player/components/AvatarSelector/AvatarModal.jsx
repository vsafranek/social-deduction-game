// src/player/components/AvatarSelector/AvatarModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import './AvatarModal.css';

function AvatarModal({ avatars, currentAvatar, onSelect, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Initialize index based on current avatar only once when component mounts
    if (avatars.length > 0) {
      const index = avatars.findIndex(a => a.avatarPath === currentAvatar);
      return index >= 0 ? index : 0;
    }
    return 0;
  });
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const modalRef = useRef(null);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : avatars.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < avatars.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && avatars[currentIndex]) {
        e.preventDefault();
        handleSelect(avatars[currentIndex].avatarPath);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, avatars]);

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrevious();
    }
  };

  const handleSelect = (avatarPath) => {
    if (onSelect) {
      onSelect(avatarPath);
    }
  };

  if (avatars.length === 0) {
    return null;
  }

  const currentAvatarData = avatars[currentIndex];
  const isCurrent = currentAvatarData.avatarPath === currentAvatar;

  return (
    <div className="avatar-modal-overlay" onClick={onClose} ref={modalRef}>
      <div 
        className="avatar-modal-content"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button className="avatar-modal-close" onClick={onClose}>×</button>
        
        <div className="avatar-modal-header">
          <h2>Vyber si avatar</h2>
          <p className="avatar-modal-counter">{currentIndex + 1} / {avatars.length}</p>
        </div>

        <div className="avatar-modal-main">
          <button 
            className="avatar-modal-nav avatar-modal-nav-left"
            onClick={handlePrevious}
            aria-label="Předchozí avatar"
          >
            ‹
          </button>

          <div className="avatar-modal-display">
            <img
              src={currentAvatarData.avatarPath}
              alt={currentAvatarData.displayName}
              className="avatar-modal-image"
            />
          </div>

          <button 
            className="avatar-modal-nav avatar-modal-nav-right"
            onClick={handleNext}
            aria-label="Další avatar"
          >
            ›
          </button>
        </div>

        <div className="avatar-modal-footer">
          <button 
            className="avatar-modal-select-btn"
            onClick={() => handleSelect(currentAvatarData.avatarPath)}
            disabled={isCurrent}
          >
            {isCurrent ? 'Aktuální avatar' : 'Vybrat tento avatar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AvatarModal;
