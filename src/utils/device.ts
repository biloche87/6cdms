import React, { useState, useEffect } from 'react';

/**
 * Utility to detect whether the current display is mobile or tablet.
 * Per requirements: Hardware camera and GPS activation requests must ONLY function
 * in mobile and tablet display (viewport width <= 1024px).
 * On desktop display (viewport width > 1024px), hardware camera and GPS prompts are never requested.
 */
export const isMobileOrTablet = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Detect explicit mobile device user agent
  const isMobileUA =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      navigator.userAgent || ''
    );

  // If desktop screen display (> 1024px) and not mobile UA, it is strictly desktop display
  if (window.innerWidth > 1024 && !isMobileUA) {
    return false;
  }

  // Mobile and tablet display viewport (<= 1024px) or mobile device
  return window.innerWidth <= 1024 || isMobileUA;
};

/**
 * React hook to reactively track whether the current display is mobile or tablet.
 * Updates on resize, orientationchange, and mount.
 */
export const useIsMobileOrTablet = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(isMobileOrTablet);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileOrTablet());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
};
