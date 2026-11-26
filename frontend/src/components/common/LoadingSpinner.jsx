import React from 'react';

export const LoadingSpinner = ({ primary = false }) => {
  return <div className={`spinner ${primary ? 'spinner-primary' : ''}`} />;
};
