/** Boot: wires storage, HUD and the game loop together. */

import './styles.css';

import { Game } from './game/game';
import type { Phase } from './game/game';
import { bestFor, load, recordBest, save } from './game/storage';
import type { SaveData } from './game/storage';
import { resolveTheme } from './game/theme';
import type { ThemeName, ThemePreference } from './game/theme';
import { detectLang } from './i18n';
import type { Lang } from './i18n';
import { formatTime } from './ui/format';
import { Hud } from './ui/hud';
import type { OverlayKind } from './ui/hud';

const THEME_CYCLE: readonly ThemePreference[] = ['auto', 'dark', 'light'];
const THEME_COLOR: Record<ThemeName, string> = { dark: '#05060b', light: '#f4f5fa' };

function requireElement<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing element #${id}`);
  return node as T;
}

const state: SaveData = load();
let lang: Lang = state.lang ?? detectLang();

const board = requireElement('board');
const canvas = requireElement<HTMLCanvasElement>('canvas');

const hud = new Hud({
  onOverlayAction: (kind: OverlayKind) => {
    if (kind === 'intro') {
      state.introSeen = true;
      save(state);
      hud.hideOverlay();
      board.focus({ preventScroll: true });
      return;
    }
    if (kind === 'failed') {
      game.restart();
      board.focus({ preventScroll: true });
      return;
    }
    goToLevel(game.currentLevel + 1);
  },
  onOverlaySecondary: (kind: OverlayKind) => {
    // Only the solved screen offers one, and it replays the level just solved
    // so the best time is something you can actually chase.
    if (kind !== 'solved') return;
    game.restart();
    board.focus({ preventScroll: true });
  },
  onRestart: () => {
    game.restart();
    board.focus({ preventScroll: true });
  },
  onToggleLang: () => {
    lang = lang === 'pl' ? 'en' : 'pl';
    state.lang = lang;
    save(state);
    hud.setLang(lang);
  },
  onCycleTheme: () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(state.theme) + 1) % THEME_CYCLE.length];
    state.theme = next;
    save(state);
    applyTheme();
  },
  onHelp: () => {
    hud.showOverlay('intro');
  },
});

const game = new Game({
  canvas,
  surface: board,
  hooks: {
    onPhase: handlePhase,
    onProgress: (remaining, total) => {
      hud.setProgress(remaining);
      hud.setRestartEnabled(remaining < total);
    },
    onElapsed: (ms) => {
      hud.setTime(ms);
    },
    onDeadEnd: (active) => {
      hud.setDeadEnd(active);
      // Announced only on the way in — the ring and the red counter carry it
      // visually, but a keyboard player has neither in view.
      if (active) hud.announce('a11yDeadEnd');
    },
  },
});

function handlePhase(phase: Phase): void {
  switch (phase) {
    case 'drawing':
      hud.hideOverlay();
      hud.announce('a11yStart');
      return;

    case 'idle':
      hud.hideOverlay();
      hud.setTime(0);
      return;

    case 'failed':
      hud.showOverlay('failed');
      hud.announce('a11yFailed');
      return;

    case 'solved': {
      const level = game.currentLevel;
      const elapsed = game.elapsedMs;
      const isNewBest = recordBest(state, level, elapsed);
      state.level = Math.max(state.level, level + 1);
      save(state);

      hud.setTime(elapsed);
      hud.setBest(bestFor(state, level));
      hud.showOverlay('solved', { timeMs: elapsed, isNewBest });
      hud.announce('a11ySolved', { time: formatTime(elapsed, 2) });
      return;
    }
  }
}

function goToLevel(level: number): void {
  game.loadLevel(level);
  hud.setLevel(level);
  hud.setBest(bestFor(state, level));
  board.focus({ preventScroll: true });
}

function applyTheme(): void {
  const resolved = resolveTheme(state.theme);
  document.documentElement.dataset.theme = resolved;
  requireElement<HTMLMetaElement>('meta-theme-color').content = THEME_COLOR[resolved];
  game.setTheme(resolved);
  hud.setThemePreference(state.theme);
}

if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.theme === 'auto') applyTheme();
  });
}

hud.setLang(lang);
applyTheme();
goToLevel(state.level);
game.start();

if (!state.introSeen) {
  hud.showOverlay('intro');
} else {
  board.focus({ preventScroll: true });
}
