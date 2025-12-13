// src/moderator/components/ConfirmModal/ConfirmModal.jsx
import React from 'react';
import './ConfirmModal.css';

function ConfirmModal({ 
  title, 
  message, 
  confirmText = 'Potvrdit', 
  cancelText = 'Zrušit',
  onConfirm, 
  onCancel,
  isDanger = false 
}) {
  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <h2>{title}</h2>
          <button className="confirm-modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="confirm-modal-content">
          <p>{message}</p>
        </div>

        <div className="confirm-modal-footer">
          <button 
            className={`confirm-modal-button confirm-modal-cancel`}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-modal-button confirm-modal-confirm ${isDanger ? 'danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
