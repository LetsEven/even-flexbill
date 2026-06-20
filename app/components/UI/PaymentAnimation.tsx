// components/PaymentAnimation.tsx
"use client";

import { useEffect } from "react";

interface PaymentAnimationProps {
  isActive: boolean;
  onAnimationComplete?: () => void;
}

export default function PaymentAnimation({
  isActive,
  onAnimationComplete,
}: PaymentAnimationProps) {
  useEffect(() => {
    if (!isActive) return;

    // Navegar cuando termina la animación del checkmark (~1.2s)
    // El overlay permanece visible — no hay fade negro
    const timer = setTimeout(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [isActive, onAnimationComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[99999] brand-evergreen">
      {/* Animated Checkmark SVG */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animated_checkmark">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 130.2 130.2"
            style={{ width: "200px", height: "200px", display: "block" }}
          >
            <circle
              className="path circle"
              fill="none"
              stroke="#82e657"
              strokeWidth="6"
              strokeMiterlimit="10"
              cx="65.1"
              cy="65.1"
              r="62.1"
            />
            <polyline
              className="path check"
              fill="none"
              stroke="#82e657"
              strokeWidth="8"
              strokeLinecap="round"
              strokeMiterlimit="10"
              points="100.2,40.2 51.5,88.8 29.8,67.5"
            />
          </svg>
        </div>
      </div>

      {/* Success text */}
      <div
        className="absolute bottom-24 md:bottom-32 lg:bottom-40 left-0 right-0 text-center"
        style={{ animation: "fadeInText 0.4s ease-out 0.9s both" }}
      >
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white">
          ¡Pago exitoso!
        </h1>
      </div>
    </div>
  );
}
