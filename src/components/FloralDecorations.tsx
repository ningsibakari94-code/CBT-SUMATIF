import React from 'react';

export const FloralDecorations: React.FC<{ variant?: 'all' | 'subtle' }> = ({
  variant = 'all',
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none">
      {/* Top Left Botanical Branch (Sage Green & Lavender) */}
      <svg
        className="absolute -top-6 -left-6 w-36 h-36 md:w-48 md:h-48 opacity-25 text-emerald-700/60 transition-opacity"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 10 C 40 40, 80 50, 140 40 C 100 80, 80 120, 20 150"
          stroke="#4E8163"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Leaves */}
        <path
          d="M35 30 C 45 15, 65 20, 55 35 C 45 50, 30 40, 35 30 Z"
          fill="#A8D5BA"
          fillOpacity="0.45"
        />
        <path
          d="M70 42 C 85 30, 105 38, 95 55 C 80 65, 65 55, 70 42 Z"
          fill="#7A66AC"
          fillOpacity="0.3"
        />
        <path
          d="M95 75 C 115 70, 125 90, 105 100 C 90 105, 85 85, 95 75 Z"
          fill="#A8D5BA"
          fillOpacity="0.4"
        />
        <path
          d="M50 85 C 40 105, 60 115, 70 100 C 75 90, 60 75, 50 85 Z"
          fill="#E07A93"
          fillOpacity="0.3"
        />
        {/* Little bud */}
        <circle cx="120" cy="45" r="4" fill="#E07A93" fillOpacity="0.6" />
        <circle cx="35" cy="115" r="3.5" fill="#7A66AC" fillOpacity="0.5" />
      </svg>

      {/* Top Right Little Flowers (Pink Blush & Lavender) */}
      <svg
        className="absolute -top-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-25 transition-opacity"
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M130 10 C 100 40, 90 70, 95 130"
          stroke="#5D4B8B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Flower Petals */}
        <circle cx="95" cy="55" r="8" fill="#FCEEF2" stroke="#E07A93" strokeWidth="1.5" />
        <circle cx="85" cy="50" r="6" fill="#FCEEF2" stroke="#E07A93" strokeWidth="1" />
        <circle cx="105" cy="50" r="6" fill="#FCEEF2" stroke="#E07A93" strokeWidth="1" />
        <circle cx="90" cy="65" r="6" fill="#FCEEF2" stroke="#E07A93" strokeWidth="1" />
        <circle cx="100" cy="65" r="6" fill="#FCEEF2" stroke="#E07A93" strokeWidth="1" />
        <circle cx="95" cy="55" r="3" fill="#E8B4C8" />
        {/* Sage leaf */}
        <path
          d="M110 85 C 130 85, 125 105, 105 100 C 95 95, 100 85, 110 85 Z"
          fill="#A8D5BA"
          fillOpacity="0.4"
        />
      </svg>

      {variant === 'all' && (
        <>
          {/* Bottom Left Delicate Blossom */}
          <svg
            className="absolute -bottom-6 -left-6 w-36 h-36 md:w-44 md:h-44 opacity-20 pointer-events-none"
            viewBox="0 0 150 150"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 140 C 40 110, 60 90, 130 90"
              stroke="#4E8163"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M40 120 C 35 100, 55 95, 60 110 C 65 120, 50 130, 40 120 Z"
              fill="#A8D5BA"
              fillOpacity="0.4"
            />
            <circle cx="75" cy="98" r="5" fill="#E07A93" fillOpacity="0.4" />
            <circle cx="110" cy="92" r="4" fill="#7A66AC" fillOpacity="0.4" />
          </svg>

          {/* Bottom Right Soft Leaf Accent */}
          <svg
            className="absolute -bottom-6 -right-6 w-36 h-36 md:w-44 md:h-44 opacity-20 pointer-events-none"
            viewBox="0 0 150 150"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M140 140 C 110 100, 70 80, 20 85"
              stroke="#7A66AC"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M100 115 C 85 105, 95 85, 110 95 C 120 105, 115 120, 100 115 Z"
              fill="#D8CCE8"
              fillOpacity="0.45"
            />
            <path
              d="M60 88 C 45 75, 55 60, 70 70 C 80 80, 75 95, 60 88 Z"
              fill="#A8D5BA"
              fillOpacity="0.4"
            />
          </svg>
        </>
      )}
    </div>
  );
};
