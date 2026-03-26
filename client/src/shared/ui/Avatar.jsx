import React from 'react';

/**
 * Avatar component for user profile and navbar usage.
 * @param {string} avatarUrl - The URL of the user's avatar image.
 * @param {string} name - The user's name (for fallback initial).
 * @param {string} size - Tailwind width/height (e.g., 'w-16 h-16').
 * @param {string} className - Additional classes.
 * @param {string} alt - Alt text for the image.
 * @returns {JSX.Element}
 */
export default function Avatar({ avatarUrl, name, size = 'w-16 h-16', className = '', alt = 'Profile avatar' }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={alt}
        className={`${size} rounded-full border-3 border-neo-black shadow-neo object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`${size} bg-neo-lavender border-3 border-neo-black shadow-neo flex items-center justify-center font-heading text-2xl uppercase rounded-full ${className}`}
    >
      {name?.[0] || '?'}
    </div>
  );
}
