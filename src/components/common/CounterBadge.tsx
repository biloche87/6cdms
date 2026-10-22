import React from 'react';

export interface CounterBadgeProps {
  count?: number | null;
  /**
   * Couleur exacte du conteneur pour l'anneau de 2px (détache la bulle de son support).
   * Par défaut : utilise 'var(--notif-bubble-ring, var(--bg-card))'
   * (blanc en thème clair, couleur de carte en thème sombre, jamais du noir).
   */
  containerBg?: string;
  borderColor?: string; // alias de rétro-compatibilité
  className?: string;
  ariaLabel?: string;
}

/**
 * Composant partagé UNIQUE pour toutes les bulles de notification rouges (Règle 6C DMS) :
 * - Fond #DC2626
 * - Texte et chiffre en BLANC pur #FFFFFF (color: #FFFFFF !important)
 * - Nombre uniquement ("99+" au-delà de 99, aucune bulle si 0)
 * - SUPPRIME tout contour noir ou sombre : border: none et outline: none, sans ombre noire
 * - Anneau de 2 px de la couleur exacte du fond du conteneur (blanc en clair, couleur de carte en sombre via variable)
 * - Gras 13 px, 20 px minimum (h: 20px, min-w: 20px)
 */
export const CounterBadge: React.FC<CounterBadgeProps> = ({
  count,
  containerBg,
  borderColor,
  className = '',
  ariaLabel,
}) => {
  if (count === undefined || count === null || count <= 0) {
    return null;
  }

  const displayCount = count > 99 ? '99+' : count;
  const ringColor = containerBg || borderColor || 'var(--notif-bubble-ring, var(--bg-card))';

  return (
    <span
      className={`counter-badge-shared inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 font-bold text-[13px] leading-none rounded-full select-none pointer-events-none whitespace-nowrap ${className}`}
      style={{
        backgroundColor: '#DC2626',
        color: '#FFFFFF',
        border: 'none',
        outline: 'none',
        boxShadow: `0 0 0 2px ${ringColor}`,
      }}
      aria-label={ariaLabel || `${displayCount} notifications`}
    >
      {displayCount}
    </span>
  );
};

export default CounterBadge;
