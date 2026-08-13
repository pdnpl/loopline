/**
 * Local progress. No account, no server, no network — just this browser.
 *
 * Every access is guarded: Safari private mode throws on `localStorage`, and a
 * puzzle game has no business breaking because of it.
 */

import type { Lang } from '../i18n';
import type { ThemePreference } from './theme';

const STORAGE_KEY = 'loopline:v1';

export interface SaveData {
  version: 1;
  /** Highest level reached. */
  level: number;
  /** Best completion time in ms, keyed by level number. */
  best: Record<string, number>;
  /** `null` until the player picks a language; before that we follow the browser. */
  lang: Lang | null;
  theme: ThemePreference;
  introSeen: boolean;
}

function defaults(): SaveData {
  return { version: 1, level: 1, best: {}, lang: null, theme: 'auto', introSeen: false };
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function load(): SaveData {
  const raw = readRaw();
  if (raw === null) return defaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaults();

    const data = parsed as Partial<SaveData>;
    const base = defaults();
    return {
      version: 1,
      level:
        typeof data.level === 'number' && data.level >= 1 ? Math.floor(data.level) : base.level,
      best: typeof data.best === 'object' && data.best !== null ? data.best : base.best,
      lang: data.lang === 'pl' || data.lang === 'en' ? data.lang : base.lang,
      theme:
        data.theme === 'dark' || data.theme === 'light' || data.theme === 'auto'
          ? data.theme
          : base.theme,
      introSeen: data.introSeen === true,
    };
  } catch {
    return defaults();
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable or full — progress just will not persist.
  }
}

export function bestFor(data: SaveData, level: number): number | null {
  const value = data.best[String(level)];
  return typeof value === 'number' ? value : null;
}

/**
 * Wipes progress — level and every best time — while keeping the preferences a
 * player set deliberately. Starting the game over should not also undo their
 * choice of language and theme.
 */
export function resetProgress(data: SaveData): void {
  data.level = 1;
  data.best = {};
}

/** Records a time when it beats the stored one. Returns true if it was a record. */
export function recordBest(data: SaveData, level: number, ms: number): boolean {
  const current = bestFor(data, level);
  if (current !== null && current <= ms) return false;
  data.best[String(level)] = ms;
  return true;
}
