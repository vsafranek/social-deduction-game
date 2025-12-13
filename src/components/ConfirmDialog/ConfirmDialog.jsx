// src/components/ConfirmDialog/ConfirmDialog.jsx
import React from 'react';
import './ConfirmDialog.css';

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) {
  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h2>{title}</h2>
        </div>
        
        <div className="confirm-dialog-body">
          <p>{message}</p>
        </div>
        
        <div className="confirm-dialog-actions">
          <button 
            className="confirm-btn confirm-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className="confirm-btn confirm-btn-confirm"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;


