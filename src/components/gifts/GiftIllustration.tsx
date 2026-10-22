import React, { useState } from 'react';

interface GiftIllustrationProps {
  svgKey?: string | null;
  name?: string;
  tier?: 'BRONZE' | 'OR' | 'AUCUN';
  customPhoto?: string | null;
  photoUrl?: string | null;
  photo_url?: string | null;
  className?: string;
  size?: number;
  showRealBadge?: boolean;
  onClick?: () => void;
}

export const GiftIllustration: React.FC<GiftIllustrationProps> = ({
  svgKey,
  name = 'Cadeau',
  tier = 'BRONZE',
  customPhoto,
  photoUrl,
  photo_url,
  className = 'w-24 h-24',
  size = 96,
  showRealBadge = false,
  onClick,
}) => {
  const [imgError, setImgError] = useState<boolean>(false);
  const photoSrc = customPhoto || photoUrl || photo_url;

  if (photoSrc && !imgError) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${className} ${
          onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
        }`}
        onClick={onClick}
        title={onClick ? `Agrandir la photo de ${name}` : name}
      >
        <img
          src={photoSrc}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
        {showRealBadge && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#15803D]/95 text-white shadow-xs">
            Photo Réelle
          </span>
        )}
      </div>
    );
  }

  // Consistent solid accents without gradients
  const tierBorderColor = tier === 'OR' ? '#92400E' : '#92400E';
  const tierBadgeBg = tier === 'OR' ? '#15803D' : '#92400E';

  const renderSvgContent = () => {
    switch (svgKey.toLowerCase()) {
      case 'tv':
        return (
          // TV Smart
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full text-slate-800 dark:text-slate-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* TV Screen Outer Frame */}
            <rect x="10" y="15" width="80" height="52" rx="4" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#92400E" strokeWidth="3" />
            {/* Inner Screen */}
            <rect x="15" y="20" width="70" height="42" fill="#15803D" stroke="#15803D" strokeWidth="1" />
            {/* Play triangle on screen */}
            <polygon points="46,33 46,49 58,41" fill="#FFFFFF" stroke="#FFFFFF" />
            {/* Stand */}
            <line x1="50" y1="67" x2="50" y2="76" stroke="#92400E" strokeWidth="4" />
            <path d="M32 78 L68 78" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
            {/* Power LED */}
            <circle cx="50" cy="63" r="1.5" fill="#DC2626" />
          </svg>
        );

      case 'fridge':
        return (
          // Mini Frigo
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Fridge Body */}
            <rect x="25" y="12" width="50" height="72" rx="6" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#92400E" strokeWidth="3" />
            {/* Freezer Door Division */}
            <line x1="25" y1="36" x2="75" y2="36" stroke="#92400E" strokeWidth="3" />
            {/* Upper Handle */}
            <rect x="68" y="20" width="3" height="10" rx="1" fill="#15803D" />
            {/* Lower Handle */}
            <rect x="68" y="44" width="3" height="18" rx="1" fill="#15803D" />
            {/* Base Feet */}
            <rect x="30" y="84" width="8" height="4" rx="1" fill="#92400E" />
            <rect x="62" y="84" width="8" height="4" rx="1" fill="#92400E" />
            {/* Temperature badge */}
            <circle cx="36" cy="24" r="3" fill="#15803D" />
          </svg>
        );

      case 'blender':
        return (
          // Mixeur
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Lid */}
            <rect x="35" y="12" width="30" height="6" rx="2" fill="#92400E" stroke="#92400E" />
            <rect x="44" y="8" width="12" height="4" rx="1" fill="#92400E" />
            {/* Glass Jar */}
            <polygon points="35,18 65,18 60,56 40,56" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#15803D" strokeWidth="3" />
            {/* Measurement lines */}
            <line x1="44" y1="28" x2="52" y2="28" stroke="#15803D" strokeWidth="2" />
            <line x1="43" y1="36" x2="53" y2="36" stroke="#15803D" strokeWidth="2" />
            <line x1="42" y1="44" x2="52" y2="44" stroke="#15803D" strokeWidth="2" />
            {/* Jar Handle */}
            <path d="M64 24 C72 24 72 46 60 48" stroke="#15803D" strokeWidth="3" fill="none" />
            {/* Motor Base */}
            <polygon points="37,56 63,56 67,82 33,82" fill="#92400E" stroke="#92400E" strokeWidth="2" />
            {/* Speed Dial */}
            <circle cx="50" cy="69" r="5" fill="#E2E8F0" stroke="#15803D" strokeWidth="2" />
            <line x1="50" y1="69" x2="53" y2="67" stroke="#DC2626" strokeWidth="2" />
            {/* Rubber Feet */}
            <line x1="36" y1="83" x2="42" y2="83" stroke="#92400E" strokeWidth="3" />
            <line x1="58" y1="83" x2="64" y2="83" stroke="#92400E" strokeWidth="3" />
          </svg>
        );

      case 'coffeemaker':
        return (
          // Machine à café
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Machine Main Body */}
            <rect x="25" y="14" width="50" height="70" rx="4" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#92400E" strokeWidth="3" />
            {/* Top Water/Bean Reservoir */}
            <rect x="30" y="18" width="40" height="12" rx="2" fill="#92400E" stroke="#92400E" />
            {/* Dispenser Head */}
            <rect x="42" y="34" width="16" height="12" rx="2" fill="#15803D" stroke="#15803D" />
            {/* Dual Spout */}
            <line x1="46" y1="46" x2="46" y2="50" stroke="#15803D" strokeWidth="2.5" />
            <line x1="54" y1="46" x2="54" y2="50" stroke="#15803D" strokeWidth="2.5" />
            {/* Coffee Drops */}
            <circle cx="46" cy="53" r="1.5" fill="#92400E" />
            <circle cx="54" cy="53" r="1.5" fill="#92400E" />
            {/* Cup */}
            <rect x="42" y="58" width="16" height="14" rx="2" fill="#FFFFFF" stroke="#92400E" strokeWidth="2" />
            <path d="M58 61 C63 61 63 69 58 69" stroke="#92400E" strokeWidth="2" fill="none" />
            {/* Drip Tray */}
            <rect x="30" y="74" width="40" height="6" rx="1" fill="#92400E" />
          </svg>
        );

      case 'smartphone':
        return (
          // Smartphone
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Phone Body */}
            <rect x="28" y="10" width="44" height="80" rx="7" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#15803D" strokeWidth="3" />
            {/* Screen */}
            <rect x="32" y="16" width="36" height="68" rx="4" fill="#FFFFFF" className="dark:fill-slate-900" stroke="#15803D" strokeWidth="1.5" />
            {/* Top Speaker / Camera Notch */}
            <line x1="44" y1="13" x2="56" y2="13" stroke="#15803D" strokeWidth="2" />
            <circle cx="41" cy="13" r="1" fill="#DC2626" />
            {/* App Grid on Screen */}
            <rect x="36" y="24" width="6" height="6" rx="1" fill="#15803D" />
            <rect x="47" y="24" width="6" height="6" rx="1" fill="#92400E" />
            <rect x="58" y="24" width="6" height="6" rx="1" fill="#15803D" />
            <rect x="36" y="34" width="6" height="6" rx="1" fill="#92400E" />
            <rect x="47" y="34" width="6" height="6" rx="1" fill="#15803D" />
            <rect x="58" y="34" width="6" height="6" rx="1" fill="#92400E" />
            {/* Chat/Sale Message Banner */}
            <rect x="36" y="46" width="28" height="12" rx="2" fill="#15803D" />
            <line x1="39" y1="52" x2="59" y2="52" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            {/* Home indicator bar */}
            <line x1="43" y1="80" x2="57" y2="80" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );

      case 'motorbike':
        return (
          // Moto Jakarta
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Rear Wheel */}
            <circle cx="26" cy="65" r="14" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#92400E" strokeWidth="3" />
            <circle cx="26" cy="65" r="4" fill="#92400E" />
            {/* Front Wheel */}
            <circle cx="74" cy="65" r="14" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#92400E" strokeWidth="3" />
            <circle cx="74" cy="65" r="4" fill="#92400E" />
            {/* Frame & Engine */}
            <path d="M26 65 L46 65 L52 48 L74 65" stroke="#15803D" strokeWidth="3.5" fill="none" />
            <path d="M46 65 L44 48 L65 48" stroke="#15803D" strokeWidth="3.5" fill="none" />
            {/* Seat */}
            <path d="M30 46 Q45 42 55 46" stroke="#92400E" strokeWidth="5" strokeLinecap="round" />
            {/* Fuel Tank / Body */}
            <path d="M52 44 C58 38 66 42 68 48 Z" fill="#15803D" stroke="#15803D" strokeWidth="2" />
            {/* Handlebar & Fork */}
            <line x1="74" y1="65" x2="68" y2="34" stroke="#92400E" strokeWidth="3.5" />
            <line x1="64" y1="32" x2="72" y2="34" stroke="#92400E" strokeWidth="3.5" strokeLinecap="round" />
            {/* Headlight */}
            <circle cx="72" cy="38" r="3" fill="#DC2626" />
            {/* Exhaust Pipe */}
            <path d="M45 68 L20 68" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );

      case 'computer':
        return (
          // Ordinateur portable
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Laptop Screen Upper Shell */}
            <rect x="20" y="18" width="60" height="42" rx="3" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#15803D" strokeWidth="3" />
            {/* Screen Inner Display */}
            <rect x="24" y="22" width="52" height="34" fill="#15803D" stroke="#15803D" />
            {/* Bar chart on screen display */}
            <rect x="30" y="42" width="5" height="10" fill="#FFFFFF" />
            <rect x="38" y="36" width="5" height="16" fill="#FFFFFF" />
            <rect x="46" y="30" width="5" height="22" fill="#FFFFFF" />
            <rect x="54" y="26" width="5" height="26" fill="#FFFFFF" />
            <polyline points="28,48 35,42 42,36 49,30 58,26 65,24" stroke="#92400E" strokeWidth="2" fill="none" />
            {/* Webcam */}
            <circle cx="50" cy="20" r="1" fill="#DC2626" />
            {/* Base Keyboard Platform */}
            <polygon points="12,66 88,66 82,78 18,78" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#92400E" strokeWidth="3" />
            {/* Trackpad */}
            <rect x="42" y="70" width="16" height="5" rx="1" fill="#FFFFFF" stroke="#92400E" strokeWidth="1" />
          </svg>
        );

      default:
        return (
          // Generic Gift Box
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="20" y="35" width="60" height="48" rx="4" fill="#E2E8F0" className="dark:fill-slate-800" stroke="#15803D" strokeWidth="3" />
            <rect x="16" y="26" width="68" height="12" rx="2" fill="#92400E" stroke="#92400E" strokeWidth="2" />
            <line x1="50" y1="26" x2="50" y2="83" stroke="#15803D" strokeWidth="4" />
            <path d="M50 26 C42 14 30 16 34 26 C38 32 50 26 50 26 Z" fill="#15803D" />
            <path d="M50 26 C58 14 70 16 66 26 C62 32 50 26 50 26 Z" fill="#15803D" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative flex items-center justify-center p-2 rounded-lg bg-[#E2E8F0] dark:bg-slate-800 border-2 border-[${tierBorderColor}] ${className}`}
      title={name}
      aria-label={`Illustration de ${name}`}
    >
      {renderSvgContent()}
    </div>
  );
};
