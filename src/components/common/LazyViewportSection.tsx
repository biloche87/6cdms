import React from 'react';

interface LazyViewportSectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  minHeight?: string | number;
  className?: string;
  rootMargin?: string;
}

/**
 * Robust Viewport Section: renders children immediately to ensure zero delay,
 * no layout shifts, and full reliability inside nested scroll containers and iframes.
 */
export const LazyViewportSection: React.FC<LazyViewportSectionProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

