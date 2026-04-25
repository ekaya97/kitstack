"use client";

import { useState } from "react";

export function RatingInput({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);

  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="cursor-pointer transition-transform hover:scale-110"
        >
          <svg width={size} height={size} viewBox="0 0 16 16">
            <path
              d="M8 1 L10 6 L15 6 L11 9 L12.5 14 L8 11 L3.5 14 L5 9 L1 6 L6 6 Z"
              fill={star <= (hover || value) ? "#d65a2f" : "none"}
              stroke="#d65a2f"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </span>
  );
}
