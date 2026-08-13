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

export type OverlayKind = 'intro' | 'failed' | 'solved' | 'levels';

export interface OverlayData {
  /** Completion time in ms, for the solved screen. */
  timeMs?: number;
  isNewBest?: boolean;
  /** Level being played, for the level picker. */
  current?: number;
  /** Highest level reached — everything from 1 up to here is playable. */
  unlocked?: number;
  /** Best time per level, keyed by level number as a string. */
  best?: Readonly<Record<string, number>>;
}

export interface HudHandlers {
  /** Overlay primary action — retry, next level, close, or dismiss the intro. */
  onOverlayAction(kind: OverlayKind): void;
  /** Overlay secondary action: replay on solved, erase progress on the picker. */
  onOverlaySecondary(kind: OverlayKind): void;
  /** The dock button. Opens the level picker. */
  onOpenLevels(): void;
  onPickLevel(level: number): void;
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
  private readonly progressFill = el('progress-fill');
  private readonly progressValue = el('progress-value');

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
  private readonly btnLevels = el<HTMLButtonElement>('btn-levels');
  private readonly overlayLevels = el('overlay-levels');
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
  private drawn = 0;
  private total = 0;
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

    // Anything inside the tap-anywhere veil must stop its pointerdown reaching
    // the veil, or it would fire the primary action too. It must NOT
    // preventDefault, though: that is what suppresses a button's own `:active`
    // state and makes it feel dead (ADR-0018). Stop the bubble, act on click.
    this.overlaySecondary.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    this.overlaySecondary.addEventListener('click', (event) => {
      event.stopPropagation();
      this.activateSecondary();
    });

    // Plain `click`, and no preventDefault. This is navigation, not the fast
    // retry path — that is the overlay — so there is nothing to gain from
    // pointerdown, and preventDefault there suppressed the compatibility mouse
    // events, which took the button's own `:active` press state and focus with
    // them. The control looked dead because it stopped looking pressed.
    this.btnLevels.addEventListener('click', () => {
      this.guard('levels', () => {
        handlers.onOpenLevels();
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
      if (kind === 'levels' && !this.resetArmed) {
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
    setText(this.btnLevels, this.t('levels'));
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

  setProgress(remaining: number, total: number): void {
    this.total = Math.max(1, total);
    this.drawn = Math.max(0, this.total - remaining);
    this.renderProgress();
  }

  /**
   * A bar rather than a sentence. "5 lines left" made a reader ask *which*
   * lines, and answering it in words needs a noun the player has never been
   * taught. A fill that grows as the figure is traced names nothing and teaches
   * itself; the fraction beside it is there for precision, not for reading.
   */
  private renderProgress(): void {
    const fraction = this.drawn / this.total;
    this.progressFill.style.width = `${(fraction * 100).toFixed(2)}%`;
    setText(this.progressValue, `${this.drawn}/${this.total}`);

    // The words live only where a screen reader needs them.
    this.progress.setAttribute('aria-label', this.t('a11yProgress'));
    this.progress.setAttribute('aria-valuemax', String(this.total));
    this.progress.setAttribute('aria-valuenow', String(this.drawn));
    this.progress.setAttribute(
      'aria-valuetext',
      this.t('a11yProgressValue', { drawn: this.drawn, total: this.total }),
    );
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
    // Focus something meaningful: the primary action, or the first level chip on
    // the picker, which has no primary action to focus.
    const first = this.overlayAction.hidden
      ? this.overlayLevels.querySelector('button')
      : this.overlayAction;
    first?.focus({ preventScroll: true });
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

  /**
   * Builds the level grid. Every level up to the highest reached is playable —
   * a level you could not solve should not be a wall, and a level you enjoyed
   * should be reachable again without replaying everything before it.
   */
  private renderLevels(data: OverlayData): void {
    const current = data.current ?? 1;
    const unlocked = Math.max(1, data.unlocked ?? 1);
    const best = data.best ?? {};

    this.overlayLevels.replaceChildren();

    for (let level = 1; level <= unlocked; level++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'level-chip';
      chip.textContent = String(level);

      const time = best[String(level)];
      const label = [`${this.t('level')} ${level}`];
      if (time !== undefined) {
        chip.classList.add('level-chip--solved');
        label.push(this.t('levelSolved', { time: formatTime(time, 2) }));
      }
      if (level === current) {
        chip.classList.add('level-chip--current');
        chip.setAttribute('aria-current', 'true');
      }
      chip.setAttribute('aria-label', label.join(', '));

      chip.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      chip.addEventListener('click', (event) => {
        event.stopPropagation();
        this.guard('level-chip', () => {
          this.handlers.onPickLevel(level);
        });
      });

      this.overlayLevels.append(chip);
    }
  }

  private renderOverlay(kind: OverlayKind, data: OverlayData): void {
    this.overlay.classList.toggle('overlay--failed', kind === 'failed');
    this.overlaySteps.hidden = kind !== 'intro';
    this.overlayTime.hidden = kind !== 'solved';
    // The solved screen offers a replay; the level picker is where the one
    // destructive action lives, next to the progress it would erase.
    this.overlaySecondary.hidden = kind === 'failed' || kind === 'intro';
    this.overlayLevels.hidden = kind !== 'levels';
    // The picker needs no confirm button: choosing a level closes it, and a tap
    // anywhere else closes it too. A "Close" button would only be a third way to
    // do what the other two already do.
    this.overlayAction.hidden = kind === 'levels';
    if (kind === 'solved') setText(this.overlaySecondary, this.t('replay'));
    if (kind === 'levels') setText(this.overlaySecondary, this.t('resetProgress'));

    if (kind === 'levels') {
      setText(this.overlayEyebrow, '');
      setText(this.overlayTitle, this.t('levelsTitle'));
      setText(this.overlayBody, this.t('levelsHint'));
      setText(this.overlayHint, this.t('tapAnywhere'));
      this.renderLevels(data);
      return;
    }

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
