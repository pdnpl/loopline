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

/**
 * Ignores the second activation of one interaction (pointerdown then click).
 *
 * Deliberately short and deliberately per-control. A shared window meant one
 * control could swallow another's press, and — worse — a second press of a
 * button that looked broken was itself discarded, so the natural way to test a
 * control was the thing that stopped it working.
 */
const ACTIVATION_GUARD_MS = 60;

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
  private readonly dock = el('dock');
  private readonly live = el('live');

  private readonly themeIcons: Record<ThemePreference, HTMLElement> = {
    auto: el('icon-auto'),
    dark: el('icon-dark'),
    light: el('icon-light'),
  };

  private lang: Lang = 'en';
  private overlayKind: OverlayKind | null = null;
  /** Last accepted activation per control. `-Infinity` so the first press on a
   *  freshly loaded page is never inside the window — `performance.now()` starts
   *  near zero, so an initial `0` swallowed everything for the first 300 ms. */
  private readonly lastActivation = new Map<string, number>();
  private remaining = 0;
  private deadEnd = false;
  /** The progress reset is destructive, so it takes two presses. */
  private resetArmed = false;

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

    // Plain `click`, and no preventDefault. The dock button is not on the fast
    // retry path — that is the overlay — so there is nothing to gain from
    // pointerdown, and preventDefault there suppressed the compatibility mouse
    // events, which took the button's own `:active` press state and focus with
    // them. The control looked dead because it stopped looking pressed.
    this.btnRestart.addEventListener('click', () => {
      this.guard('restart', () => {
        handlers.onRestart();
      });
    });

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

  private guard(control: string, action: () => void): void {
    const now = performance.now();
    const previous = this.lastActivation.get(control) ?? Number.NEGATIVE_INFINITY;
    if (now - previous < ACTIVATION_GUARD_MS) return;
    this.lastActivation.set(control, now);
    action();
  }

  private activateOverlay(): void {
    const kind = this.overlayKind;
    if (kind === null) return;
    this.guard('overlay', () => {
      this.handlers.onOverlayAction(kind);
    });
  }

  private activateSecondary(): void {
    const kind = this.overlayKind;
    if (kind === null) return;
    this.guard('overlay-secondary', () => {
      // Erasing progress is the one irreversible thing a player can do here, so
      // it asks once. The first press only changes the label.
      if (kind === 'intro' && !this.resetArmed) {
        this.resetArmed = true;
        setText(this.overlaySecondary, this.t('resetConfirm'));
        return;
      }
      this.resetArmed = false;
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
    this.resetArmed = false;
    this.renderOverlay(kind, data);
    this.overlay.hidden = false;
    // The veil covers the dock and swallows presses aimed at it, so the dock
    // goes away rather than sitting there looking pressable. `visibility` keeps
    // its box, so the board does not resize mid-overlay.
    this.dock.classList.add('dock--hidden');
    // Focus the action so keyboard and screen-reader users land on it, but do
    // not scroll — the layout is fixed.
    this.overlayAction.focus({ preventScroll: true });
  }

  hideOverlay(): void {
    this.overlayKind = null;
    this.resetArmed = false;
    this.overlay.hidden = true;
    this.dock.classList.remove('dock--hidden');
  }

  get overlayVisible(): boolean {
    return this.overlayKind !== null;
  }

  private renderOverlay(kind: OverlayKind, data: OverlayData): void {
    this.overlay.classList.toggle('overlay--failed', kind === 'failed');
    this.overlaySteps.hidden = kind !== 'intro';
    this.overlayTime.hidden = kind !== 'solved';
    // The solved screen offers a replay; the intro is where the one destructive
    // action lives, tucked behind the help button rather than on the board.
    this.overlaySecondary.hidden = kind === 'failed';
    if (kind === 'solved') setText(this.overlaySecondary, this.t('replay'));
    if (kind === 'intro') setText(this.overlaySecondary, this.t('resetProgress'));

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
