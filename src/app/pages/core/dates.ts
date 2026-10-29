// Affichage des dates en français, le même partout dans l'application.

const LOCALE = 'fr-FR';

/** « 14 h 05 » */
export function formatHour(value: string | Date): string {
  const date = new Date(value);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getHours()} h ${minutes}`;
}

/** « sam. 31 oct. » */
export function formatShortDay(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** « 29 octobre 2026 » */
export function formatLongDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** « sam. 31 oct. · 14 h 00 – 17 h 00 », ou « sam. 31 oct. 14 h 00 – dim. 1 nov. 10 h 00 » sur deux jours. */
export function formatRange(start: string | Date, end?: string | Date | null): string {
  if (!end) return `${formatShortDay(start)} · ${formatHour(start)}`;
  if (new Date(start).toDateString() === new Date(end).toDateString()) {
    return `${formatShortDay(start)} · ${formatHour(start)} – ${formatHour(end)}`;
  }
  return `${formatShortDay(start)} ${formatHour(start)} – ${formatShortDay(end)} ${formatHour(end)}`;
}

/** Moment d'un message ou d'une demande : « aujourd'hui, 14 h 05 », « hier, 9 h 30 », « 27 oct., 9 h 30 ». */
export function formatMoment(value: string | Date): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  let day: string;
  if (date.toDateString() === today.toDateString()) day = 'aujourd’hui';
  else if (date.toDateString() === yesterday.toDateString()) day = 'hier';
  else {
    day = date.toLocaleDateString(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    });
  }
  return `${day}, ${formatHour(date)}`;
}

/** Morceaux d'une date pour une pastille de calendrier : { day: '31', month: 'oct.', weekday: 'sam.' }. */
export function calendarParts(value: string | Date): { day: string; month: string; weekday: string } {
  const date = new Date(value);
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString(LOCALE, { month: 'short' }),
    weekday: date.toLocaleDateString(LOCALE, { weekday: 'short' }),
  };
}

/** Valeur « AAAA-MM-JJ » d'aujourd'hui, pour l'attribut min d'un champ date. */
export function todayInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
