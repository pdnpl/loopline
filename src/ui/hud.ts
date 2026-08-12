/**
 * DOM chrome around the canvas: stats, controls and the overlay.
 *
 * Text is written only when it actually changes — the stopwatch ticks every
 * frame, and blindly assigning `textContent` 120 times a second would dirty
 * layout for no reason.
 */

import type { Lang, MessageKey } from '../i18n';
import { translate } from '../i18n';
import type { ThemePreference } from '../game/theme';
import { formatTime } from './format';

export type OverlayKind = 'intro' | 'failed' | 'solved';

export interface OverlayData {
  /** Completion time in ms, for the solved screen. */
  timeMs?: number;
  isNewBest?: boolean;
}

export interface HudHandlers {
  /** Overlay primary action — retry, next level, or dismiss the intro. */
  onOverlayAction(kind: OverlayKind): void;
  /** Overlay secondary action. Only the solved screen has one: replay. */
  onOverlaySecondary(kind: OverlayKind): void;
  onRestart(): void;
  onToggleLang(): void;
  onCycleTheme(): void;
  onHelp(): void;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing element #${id}`);
  return node as T;
}

function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

/** Ignores the second activation of one interaction (pointerdown then click). */
const ACTIVATION_GUARD_MS = 300;

export class Hud {
  private readonly statLevel = el('stat-level');
  private readonly statTime = el('stat-time');
  private readonly statBest = el('stat-best');
  private readonly progress = el('progress');
  private readonly progressValue = el('progress-value');
  private readonly progressLabel = el('progress-label');

  private readonly overlay = el('overlay');
  private readonly overlayEyebrow = el('overlay-eyebrow');
  private readonly overlayTitle = el('overlay-title');
  private readonly overlayBody = el('overlay-body');
  private readonly overlaySteps = el('overlay-steps');
  private readonly overlayTime = el('overlay-time');
  private readonly overlayAction = el<HTMLButtonElement>('overlay-action');
  private readonly overlaySecondary = el<HTMLButtonElement>('overlay-secondary');
  private readonly overlayHint = el('overlay-hint');

  private readonly btnLang = el<HTMLButtonElement>('btn-lang');
  private readonly btnTheme = el<HTMLButtonElement>('btn-theme');
  private readonly btnHelp = el<HTMLButtonElement>('btn-help');
  private readonly btnRestart = el<HTMLButtonElement>('btn-restart');
  private readonly live = el('live');

  private readonly themeIcons: Record<ThemePreference, HTMLElement> = {
    auto: el('icon-auto'),
    dark: el('icon-dark'),
    light: el('icon-light'),
  };

  private lang: Lang = 'en';
  private overlayKind: OverlayKind | null = null;
  private lastActivation = 0;
  private remaining = 0;
  private deadEnd = false;

  constructor(private readonly handlers: HudHandlers) {
    // Pointer-down rather than click: the retry loop should react on touch, not
    // on release. `click` is kept for keyboard activation only.
    this.overlay.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.activateOverlay();
    });
    this.overlayAction.addEventListener('click', () => {
      this.activateOverlay();
    });

    // The secondary action sits inside the tap-anywhere region, so it has to
    // stop the event reaching the veil or it would fire the primary action too.
    this.overlaySecondary.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.activateSecondary();
    });
    this.overlaySecondary.addEventListener('click', (event) => {
      event.stopPropagation();
      this.activateSecondary();
    });

    // Browsers do not dispatch pointer events to a disabled control, but that
    // has been inconsistent enough historically to be worth stating outright —
    // a Restart that runs on an empty board is exactly the "pressed it, nothing
    // happened" bug this state exists to prevent.
    const restart = (): void => {
      if (this.btnRestart.disabled) return;
      this.guard(() => {
        handlers.onRestart();
      });
    };
    this.btnRestart.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      restart();
    });
    this.btnRestart.addEventListener('click', restart);

    this.btnLang.addEventListener('click', () => {
      handlers.onToggleLang();
    });
    this.btnTheme.addEventListener('click', () => {
      handlers.onCycleTheme();
    });
    this.btnHelp.addEventListener('click', () => {
      handlers.onHelp();
    });
  }

  private guard(action: () => void): void {
    const now = performance.now();
    if (now - this.lastActivation < ACTIVATION_GUARD_MS) return;
    this.lastActivation = now;
    action();
  }

  private activateOverlay(): void {
    const kind = this.overlayKind;
    if (kind === null) return;
    this.guard(() => {
      this.handlers.onOverlayAction(kind);
    });
  }

  private activateSecondary(): void {
    const kind = this.overlayKind;
    if (kind === null) return;
    this.guard(() => {
      this.handlers.onOverlaySecondary(kind);
    });
  }

  private t(key: MessageKey, params?: Readonly<Record<string, string | number>>): string {
    return translate(this.lang, key, params);
  }

  // -- state ---------------------------------------------------------------

  setLang(lang: Lang): void {
    this.lang = lang;
    document.documentElement.lang = lang;

    for (const node of document.querySelectorAll<HTMLElement>('[data-text]')) {
      const key = node.dataset.text as MessageKey | undefined;
      if (key !== undefined) setText(node, this.t(key));
    }

    setText(this.btnLang, lang.toUpperCase());
    this.btnLang.setAttribute('aria-label', this.t('language'));
    this.btnHelp.setAttribute('aria-label', this.t('help'));
    setText(this.btnRestart, this.t('restart'));
    this.renderProgress();

    el('board').setAttribute('aria-label', this.t('a11yBoard'));

    if (this.overlayKind !== null) this.renderOverlay(this.overlayKind, this.lastOverlayData);
  }

  setThemePreference(preference: ThemePreference): void {
    for (const [name, icon] of Object.entries(this.themeIcons)) {
      icon.hidden = name !== preference;
    }
    const label =
      preference === 'auto' ? 'themeAuto' : preference === 'dark' ? 'themeDark' : 'themeLight';
    this.btnTheme.setAttribute('aria-label', this.t(label));
  }

  setLevel(level: number): void {
    setText(this.statLevel, String(level));
  }

  setTime(ms: number): void {
    setText(this.statTime, formatTime(ms, 1));
  }

  setBest(ms: number | null): void {
    setText(this.statBest, ms === null ? '—' : formatTime(ms, 2));
  }

  setProgress(remaining: number): void {
    this.remaining = remaining;
    this.renderProgress();
  }

  /**
   * The dock button is only meaningful once something has been drawn. Leaving
   * it live on an untouched board makes it look broken: it is pressed, it runs,
   * and nothing visibly happens because there was nothing to clear.
   */
  setRestartEnabled(enabled: boolean): void {
    this.btnRestart.disabled = !enabled;
  }

  /**
   * A dead end takes over the counter slot rather than adding a line of its own,
   * so nothing on the board shifts at the moment the player most needs to read
   * it.
   */
  setDeadEnd(active: boolean): void {
    if (active === this.deadEnd) return;
    this.deadEnd = active;
    this.renderProgress();
  }

  private renderProgress(): void {
    if (this.deadEnd) {
      setText(this.progressValue, '');
      setText(this.progressLabel, this.t('deadEnd'));
    } else {
      setText(this.progressValue, String(this.remaining));
      setText(this.progressLabel, this.t('linesLeft'));
    }
    this.progress.classList.toggle('progress--warn', this.deadEnd);
  }

  announce(key: MessageKey, params?: Readonly<Record<string, string | number>>): void {
    this.live.textContent = this.t(key, params);
  }

  // -- overlay -------------------------------------------------------------

  private lastOverlayData: OverlayData = {};

  showOverlay(kind: OverlayKind, data: OverlayData = {}): void {
    this.overlayKind = kind;
    this.lastOverlayData = data;
    this.renderOverlay(kind, data);
    this.overlay.hidden = false;
    // Focus the action so keyboard and screen-reader users land on it, but do
    // not scroll — the layout is fixed.
    this.overlayAction.focus({ preventScroll: true });
  }

  hideOverlay(): void {
    this.overlayKind = null;
    this.overlay.hidden = true;
  }

  get overlayVisible(): boolean {
    return this.overlayKind !== null;
  }

  private renderOverlay(kind: OverlayKind, data: OverlayData): void {
    this.overlay.classList.toggle('overlay--failed', kind === 'failed');
    this.overlaySteps.hidden = kind !== 'intro';
    this.overlayTime.hidden = kind !== 'solved';
    this.overlaySecondary.hidden = kind !== 'solved';
    if (kind === 'solved') setText(this.overlaySecondary, this.t('replay'));

    if (kind === 'intro') {
      setText(this.overlayEyebrow, this.t('tagline'));
      setText(this.overlayTitle, this.t('introTitle'));
      setText(this.overlayBody, '');
      setText(el('overlay-step-1'), this.t('introStep1'));
      setText(el('overlay-step-2'), this.t('introStep2'));
      setText(el('overlay-step-3'), this.t('introStep3'));
      setText(this.overlayAction, this.t('introStart'));
      setText(this.overlayHint, this.t('keyboardHint'));
      return;
    }

    if (kind === 'failed') {
      setText(this.overlayEyebrow, '');
      setText(this.overlayTitle, this.t('failedTitle'));
      setText(this.overlayBody, this.t('failedBody'));
      setText(this.overlayAction, this.t('retry'));
      setText(this.overlayHint, this.t('tapAnywhere'));
      return;
    }

    setText(this.overlayEyebrow, data.isNewBest === true ? this.t('newBest') : '');
    setText(this.overlayTitle, this.t('solvedTitle'));
    setText(this.overlayBody, '');
    setText(this.overlayTime, formatTime(data.timeMs ?? 0, 2));
    setText(this.overlayAction, this.t('next'));
    setText(this.overlayHint, this.t('tapAnywhere'));
  }
}
