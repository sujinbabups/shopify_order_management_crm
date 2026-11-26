import React from 'react';

export const Alert = ({ type = 'error', message }) => {
  if (!message) return null;

  return (
    <div className={`alert ${type === 'success' ? 'alert-success' : 'alert-error'}`}>
      <span>{type === 'success' ? '✓' : '⚠'}</span>
      <div>{message}</div>
    </div>
  );
};
