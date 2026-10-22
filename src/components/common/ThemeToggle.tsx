import React from 'react';
import { useTheme } from '../../context/ThemeContext.tsx';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'button' | 'selector' | 'compact' | 'segmented' | 'collapsed' | 'sidebar-segmented';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  variant = 'icon',
  showLabel = false,
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // Collapsed mode: single icon showing active theme, cycling Clair → Sombre → Auto on click
  if (variant === 'collapsed') {
    const cycleTheme = () => {
      if (theme === 'light') {
        setTheme('dark');
      } else if (theme === 'dark') {
        setTheme('system');
      } else {
        setTheme('light');
      }
    };

    const activeLabel =
      theme === 'light'
        ? 'Thème clair'
        : theme === 'dark'
        ? 'Thème sombre'
        : 'Thème automatique';

    return (
      <button
        type="button"
        onClick={cycleTheme}
        title={`${activeLabel} (cliquer pour changer : Clair → Sombre → Auto)`}
        aria-label={`${activeLabel} - cliquer pour cycler : Clair, Sombre, Auto`}
        className={`h-[36px] w-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 transition cursor-pointer shadow-2xs hover:bg-emerald-500/25 active:scale-95 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${className}`}
      >
        {theme === 'light' ? (
          <Sun className="w-[18px] h-[18px] shrink-0" />
        ) : theme === 'dark' ? (
          <Moon className="w-[18px] h-[18px] shrink-0" />
        ) : (
          <Monitor className="w-[18px] h-[18px] shrink-0" />
        )}
      </button>
    );
  }

  // Sidebar segmented selector: 3 icons (soleil, lune, écran) dans un segment de 96 px de large et 32 px de haut, icônes 16 px, zone tactile 32 px min (36 px sur mobile)
  if (variant === 'sidebar-segmented') {
    return (
      <div
        role="group"
        aria-label="Sélection du thème"
        className={`inline-flex items-center w-[96px] h-[32px] p-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-subtle)] gap-0.5 select-none shrink-0 ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          title="Thème clair"
          aria-label="Thème clair"
          aria-pressed={theme === 'light'}
          className={`flex-1 h-full min-w-[32px] max-md:min-w-[36px] flex items-center justify-center rounded-md transition-all cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-emerald-500 ${
            theme === 'light'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Sun className="w-4 h-4 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          title="Thème sombre"
          aria-label="Thème sombre"
          aria-pressed={theme === 'dark'}
          className={`flex-1 h-full min-w-[32px] max-md:min-w-[36px] flex items-center justify-center rounded-md transition-all cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-emerald-500 ${
            theme === 'dark'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Moon className="w-4 h-4 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          title="Thème automatique"
          aria-label="Thème automatique"
          aria-pressed={theme === 'system'}
          className={`flex-1 h-full min-w-[32px] max-md:min-w-[36px] flex items-center justify-center rounded-md transition-all cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-emerald-500 ${
            theme === 'system'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Monitor className="w-4 h-4 shrink-0" />
        </button>
      </div>
    );
  }

  // Segmented selector (default for compact & segmented): 3 icons on one line, height 36px, no visible text
  if (variant === 'segmented' || variant === 'compact') {
    return (
      <div
        role="group"
        aria-label="Sélection du thème"
        className={`inline-flex items-center h-[36px] p-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-subtle)] gap-0.5 select-none ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          title="Thème clair"
          aria-label="Thème clair"
          aria-pressed={theme === 'light'}
          className={`h-full min-w-[36px] max-md:min-w-[40px] px-2 flex items-center justify-center rounded-md transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            theme === 'light'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Sun className="w-[18px] h-[18px] shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          title="Thème sombre"
          aria-label="Thème sombre"
          aria-pressed={theme === 'dark'}
          className={`h-full min-w-[36px] max-md:min-w-[40px] px-2 flex items-center justify-center rounded-md transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            theme === 'dark'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Moon className="w-[18px] h-[18px] shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          title="Thème automatique"
          aria-label="Thème automatique"
          aria-pressed={theme === 'system'}
          className={`h-full min-w-[36px] max-md:min-w-[40px] px-2 flex items-center justify-center rounded-md transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            theme === 'system'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Monitor className="w-[18px] h-[18px] shrink-0" />
        </button>
      </div>
    );
  }

  if (variant === 'selector') {
    return (
      <div className={`w-full grid grid-cols-3 p-1 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl gap-1 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-semibold transition truncate cursor-pointer ${
            theme === 'light'
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-xs font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Mode Clair"
        >
          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">Clair</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-semibold transition truncate cursor-pointer ${
            theme === 'dark'
              ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40 shadow-xs font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Mode Sombre"
        >
          <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="truncate">Sombre</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-semibold transition truncate cursor-pointer ${
            theme === 'system'
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-xs font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Système (Automatique)"
        >
          <Monitor className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          <span className="truncate">Auto</span>
        </button>
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition active:scale-95 min-h-[44px] ${
          resolvedTheme === 'dark'
            ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs'
        } ${className}`}
        title={resolvedTheme === 'dark' ? 'Basculer en Mode Clair' : 'Basculer en Mode Sombre'}
      >
        {resolvedTheme === 'dark' ? (
          <>
            <Sun className="w-5 h-5 text-amber-400" />
            <span>Mode Clair</span>
          </>
        ) : (
          <>
            <Moon className="w-5 h-5 text-slate-700" />
            <span>Mode Sombre</span>
          </>
        )}
      </button>
    );
  }

  // Default 'icon' variant (44px touch target, 24px icon)
  return (
    <button
      type="button"
      id="theme-toggle-btn"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-sm font-medium border transition-all active:scale-95 shadow-xs cursor-pointer ${
        resolvedTheme === 'dark'
          ? 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-slate-700 hover:border-amber-400/40'
          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 shadow-xs'
      } ${className}`}
      title={resolvedTheme === 'dark' ? 'Passer en Mode Clair' : 'Passer en Mode Sombre'}
      aria-label={resolvedTheme === 'dark' ? 'Passer en Mode Clair' : 'Passer en Mode Sombre'}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-6 h-6 text-amber-400 animate-in spin-in-180 duration-300" />
      ) : (
        <Moon className="w-6 h-6 text-slate-700 animate-in spin-in-180 duration-300" />
      )}
      {showLabel && (
        <span className="ml-2 text-sm font-semibold">
          {resolvedTheme === 'dark' ? 'Clair' : 'Sombre'}
        </span>
      )}
    </button>
  );
};
