import React from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  variant?: 'full' | 'mark' | 'badge' | 'compact-6c';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = '',
  variant = 'full',
}) => {
  const titleSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-2xl sm:text-3xl',
  };

  if (variant === 'compact-6c') {
    return (
      <span className={`font-black tracking-tight text-slate-900 dark:text-white font-display ${titleSizes[size]} ${className}`}>
        6C
      </span>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}>
        <span className="font-black text-xs tracking-tight text-slate-900 dark:text-white">
          6C <span className="text-[var(--color-green-text)]">DMS</span>
        </span>
      </div>
    );
  }

  if (variant === 'mark') {
    return (
      <span className={`font-black tracking-tight text-slate-900 dark:text-white font-display ${titleSizes[size]} ${className}`}>
        6C <span className="text-[var(--color-green-text)]">DMS</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      {/* Pure Text Brand */}
      <div className="leading-tight shrink-0">
        <div className={`font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 shrink-0 whitespace-nowrap font-display ${titleSizes[size]}`}>
          <span className="tracking-tight text-slate-900 dark:text-white">6C</span>
          <span className="text-[var(--color-green-text)]">DMS</span>
        </div>
        {showSubtitle && (
          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate hidden sm:block">
            Distribution Management System
          </div>
        )}
      </div>
    </div>
  );
};

