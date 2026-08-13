// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hud } from '../src/ui/hud';
import type { HudHandlers } from '../src/ui/hud';
import { pointerEvent } from './helpers/browser-stubs';

/**
 * Mounts the real markup rather than a fixture copy, so deleting an id from
 * index.html fails here instead of at run time in the browser.
 */
function mountRealMarkup(): void {
  const html = readFileSync('index.html', 'utf8');
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
  if (body === null) throw new Error('index.html has no <body>');
  document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/g, '');
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`missing #${id}`);
  return node as T;
}

let handlers: { [K in keyof HudHandlers]: ReturnType<typeof vi.fn> };
let hud: Hud;

beforeEach(() => {
  mountRealMarkup();
  handlers = {
    onOverlayAction: vi.fn(),
    onOverlaySecondary: vi.fn(),
    onOpenLevels: vi.fn(),
    onPickLevel: vi.fn(),
    onToggleLang: vi.fn(),
    onCycleTheme: vi.fn(),
    onHelp: vi.fn(),
  };
  hud = new Hud(handlers as unknown as HudHandlers);
  hud.setLang('en');
});

describe('Hud — levels button', () => {
  it('is never disabled', () => {
    expect(el<HTMLButtonElement>('btn-levels').disabled).toBe(false);
  });

  it('opens the picker on click, and does not intercept pointerdown', () => {
    // Click-only on purpose: preventDefault on pointerdown suppresses the
    // button's own :active state, which is what made the old control feel dead.
    el('btn-levels').dispatchEvent(pointerEvent('pointerdown', 0, 0));
    expect(handlers.onOpenLevels).not.toHaveBeenCalled();

    el('btn-levels').dispatchEvent(pointerEvent('click', 0, 0));
    expect(handlers.onOpenLevels).toHaveBeenCalledTimes(1);
  });

  it('is not silenced by another control having just been used', () => {
    // The guard used to be one shared stopwatch, so dismissing an overlay made
    // the next dock press vanish.
    hud.showOverlay('failed');
    el('overlay').dispatchEvent(pointerEvent('pointerdown', 10, 10));
    hud.hideOverlay();

    el('btn-levels').dispatchEvent(pointerEvent('click', 0, 0));
    expect(handlers.onOpenLevels).toHaveBeenCalledTimes(1);
  });
});

describe('Hud — level picker', () => {
  function open(current = 3, unlocked = 5, best: Record<string, number> = { '2': 4210 }): void {
    hud.showOverlay('levels', { current, unlocked, best });
  }

  it('offers every level up to the highest reached', () => {
    open();
    const chips = [...el('overlay-levels').querySelectorAll('button')];
    expect(chips.map((c) => c.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('marks the current level and the solved ones', () => {
    open();
    const chips = [...el('overlay-levels').querySelectorAll('button')];
    expect(chips[2].classList.contains('level-chip--current')).toBe(true);
    expect(chips[1].classList.contains('level-chip--solved')).toBe(true);
    expect(chips[0].classList.contains('level-chip--solved')).toBe(false);
    expect(chips[1].getAttribute('aria-label')).toBe('Level 2, solved in 4.21');
  });

  it('never offers a level that has not been reached', () => {
    open(1, 1, {});
    expect(el('overlay-levels').querySelectorAll('button')).toHaveLength(1);
  });

  it('picks a level without also closing via the tap-anywhere veil', () => {
    open();
    const chips = [...el('overlay-levels').querySelectorAll('button')];
    chips[0].dispatchEvent(pointerEvent('pointerdown', 10, 10));
    chips[0].dispatchEvent(pointerEvent('click', 10, 10));

    expect(handlers.onPickLevel).toHaveBeenCalledWith(1);
    // Without stopPropagation the veil would fire too, closing the picker and
    // swallowing the choice.
    expect(handlers.onOverlayAction).not.toHaveBeenCalled();
  });

  it('rebuilds the grid each time it opens', () => {
    open(3, 5);
    hud.hideOverlay();
    open(1, 2, {});
    expect(el('overlay-levels').querySelectorAll('button')).toHaveLength(2);
  });
});

describe('Hud — dock visibility', () => {
  it('takes the dock away while an overlay covers it', () => {
    // The veil sits above the dock and swallows presses aimed at it, so leaving
    // a visibly pressable button underneath is a trap.
    expect(el('dock').classList.contains('dock--hidden')).toBe(false);

    hud.showOverlay('failed');
    expect(el('dock').classList.contains('dock--hidden')).toBe(true);

    hud.hideOverlay();
    expect(el('dock').classList.contains('dock--hidden')).toBe(false);
  });
});

describe('Hud — overlay', () => {
  it('offers the right secondary action per screen', () => {
    hud.showOverlay('levels', { current: 1, unlocked: 3 });
    expect(el('overlay-secondary').hidden).toBe(false);
    expect(el('overlay-secondary').textContent).toBe('Start the game over');

    // Nothing competes with the retry on the failure screen, and the intro is
    // instructions only.
    hud.showOverlay('failed');
    expect(el('overlay-secondary').hidden).toBe(true);
    hud.showOverlay('intro');
    expect(el('overlay-secondary').hidden).toBe(true);

    hud.showOverlay('solved', { timeMs: 4210 });
    expect(el('overlay-secondary').hidden).toBe(false);
    expect(el('overlay-secondary').textContent).toBe('Beat this time');
  });

  it('asks before erasing progress, and only fires on the second press', () => {
    // One physical press is a pointerdown plus a click a few ms later, and the
    // guard collapses those into one activation. Two *separate* presses need the
    // clock to move, so it is driven explicitly here.
    const clock = vi.spyOn(performance, 'now');
    hud.showOverlay('levels', { current: 1, unlocked: 3 });

    clock.mockReturnValue(10_000);
    el('overlay-secondary').dispatchEvent(pointerEvent('click', 10, 10));
    expect(handlers.onOverlaySecondary).not.toHaveBeenCalled();
    expect(el('overlay-secondary').textContent).toBe('Erase progress? Press again');

    clock.mockReturnValue(11_000);
    el('overlay-secondary').dispatchEvent(pointerEvent('click', 10, 10));
    expect(handlers.onOverlaySecondary).toHaveBeenCalledWith('levels');
    clock.mockRestore();
  });

  it('disarms the confirmation when the overlay is dismissed', () => {
    hud.showOverlay('levels', { current: 1, unlocked: 3 });
    el('overlay-secondary').dispatchEvent(pointerEvent('click', 10, 10));
    expect(el('overlay-secondary').textContent).toBe('Erase progress? Press again');

    hud.hideOverlay();
    hud.showOverlay('levels', { current: 1, unlocked: 3 });
    expect(el('overlay-secondary').textContent).toBe('Start the game over');
  });

  it('tapping the veil runs the primary action', () => {
    hud.showOverlay('failed');
    el('overlay').dispatchEvent(pointerEvent('pointerdown', 10, 10));
    expect(handlers.onOverlayAction).toHaveBeenCalledWith('failed');
  });

  it('tapping replay does not also advance to the next level', () => {
    hud.showOverlay('solved', { timeMs: 4210 });
    // A real press is both events; the pointerdown must be stopped from reaching
    // the veil, and the click is what acts.
    el('overlay-secondary').dispatchEvent(pointerEvent('pointerdown', 10, 10));
    el('overlay-secondary').dispatchEvent(pointerEvent('click', 10, 10));

    // Without stopPropagation this would replay *and* skip forward a level.
    expect(handlers.onOverlaySecondary).toHaveBeenCalledWith('solved');
    expect(handlers.onOverlayAction).not.toHaveBeenCalled();
  });

  it('does nothing once the overlay is hidden', () => {
    hud.showOverlay('failed');
    hud.hideOverlay();
    el('overlay').dispatchEvent(pointerEvent('pointerdown', 10, 10));
    expect(handlers.onOverlayAction).not.toHaveBeenCalled();
  });

  it('re-renders the open overlay when the language changes', () => {
    hud.showOverlay('solved', { timeMs: 4210 });
    expect(el('overlay-action').textContent).toBe('Next level');

    hud.setLang('pl');
    expect(el('overlay-action').textContent).toBe('Następny poziom');
    expect(el('overlay-secondary').textContent).toBe('Popraw ten czas');
  });
});

describe('Hud — stats', () => {
  it('shows progress as a fraction and a bar, with no noun to misread', () => {
    hud.setProgress(5, 12);
    expect(el('progress-value').textContent).toBe('7/12');
    expect(el('progress-fill').style.width).toBe('58.33%');
  });

  it('reaches a full bar exactly on the last line', () => {
    hud.setProgress(0, 12);
    expect(el('progress-value').textContent).toBe('12/12');
    expect(el('progress-fill').style.width).toBe('100%');
  });

  it('starts empty on an untouched board', () => {
    hud.setProgress(12, 12);
    expect(el('progress-value').textContent).toBe('0/12');
    expect(el('progress-fill').style.width).toBe('0%');
  });

  it('carries the words only where a screen reader needs them', () => {
    hud.setProgress(5, 12);
    const bar = el('progress');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-label')).toBe('Lines drawn');
    expect(bar.getAttribute('aria-valuenow')).toBe('7');
    expect(bar.getAttribute('aria-valuemax')).toBe('12');
    expect(bar.getAttribute('aria-valuetext')).toBe('7 of 12 lines drawn');
  });

  it('formats times and shows a dash with no record yet', () => {
    hud.setTime(9420);
    expect(el('stat-time').textContent).toBe('9.4');

    hud.setBest(null);
    expect(el('stat-best').textContent).toBe('—');
    hud.setBest(9420);
    expect(el('stat-best').textContent).toBe('9.42');
  });
});
