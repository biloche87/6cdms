/**
 * Bulletproof date and datetime formatting utilities for SQLite and ISO date strings.
 * Prevents "Invalid Date" caused by SQLite space-separated timestamps or browser quirks.
 */

export function parseDate(dateInput?: string | number | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

    // Fix SQLite "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SSZ"
    let normalized = trimmed;
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
      if (!normalized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
        normalized += 'Z';
      }
    }

    let d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;

    // Fallback attempt standard parse
    d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export function formatDateTime(dateInput?: string | number | Date | null): string {
  const parsed = parseDate(dateInput);
  if (!parsed) return '—';

  return `${parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${parsed.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function formatDate(dateInput?: string | number | Date | null): string {
  const parsed = parseDate(dateInput);
  if (!parsed) return '—';

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
