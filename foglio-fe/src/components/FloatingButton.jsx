import React from 'react';
import './FloatingButton.css';

const FloatingButton = ({ onClick }) => {
  return (
    <button className="floating-add-btn" onClick={onClick} aria-label="Create new note">
      <span>+</span>
    </button>
  );
};

export default FloatingButton;
