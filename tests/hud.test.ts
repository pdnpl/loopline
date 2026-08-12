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
    onRestart: vi.fn(),
    onToggleLang: vi.fn(),
    onCycleTheme: vi.fn(),
    onHelp: vi.fn(),
  };
  hud = new Hud(handlers as unknown as HudHandlers);
  hud.setLang('en');
});

describe('Hud — restart button', () => {
  it('is never disabled, including on an untouched board', () => {
    // A greyed-out control reads as broken, and restarting an untouched board
    // is harmless, so the button stays live in every state.
    expect(el<HTMLButtonElement>('btn-restart').disabled).toBe(false);
    hud.setProgress(12);
    expect(el<HTMLButtonElement>('btn-restart').disabled).toBe(false);
  });

  it('fires on pointerdown, not on release', () => {
    el('btn-restart').dispatchEvent(pointerEvent('pointerdown', 0, 0));
    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
  });

  it('does not fire twice for one press', () => {
    // A real press produces pointerdown and then click; only the first counts.
    el('btn-restart').dispatchEvent(pointerEvent('pointerdown', 0, 0));
    el('btn-restart').dispatchEvent(pointerEvent('click', 0, 0));
    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
  });
});

describe('Hud — overlay', () => {
  it('offers a replay action only on the solved screen', () => {
    hud.showOverlay('intro');
    expect(el('overlay-secondary').hidden).toBe(true);

    hud.showOverlay('failed');
    expect(el('overlay-secondary').hidden).toBe(true);

    hud.showOverlay('solved', { timeMs: 4210 });
    expect(el('overlay-secondary').hidden).toBe(false);
    expect(el('overlay-secondary').textContent).toBe('Beat this time');
  });

  it('tapping the veil runs the primary action', () => {
    hud.showOverlay('failed');
    el('overlay').dispatchEvent(pointerEvent('pointerdown', 10, 10));
    expect(handlers.onOverlayAction).toHaveBeenCalledWith('failed');
  });

  it('tapping replay does not also advance to the next level', () => {
    hud.showOverlay('solved', { timeMs: 4210 });
    el('overlay-secondary').dispatchEvent(pointerEvent('pointerdown', 10, 10));

    // The secondary sits inside the tap-anywhere region; without
    // stopPropagation this would replay *and* skip forward a level.
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
  it('shows the counter, and hands the slot to the dead-end warning', () => {
    hud.setProgress(7);
    expect(el('progress-value').textContent).toBe('7');
    expect(el('progress-label').textContent).toBe('lines left');

    hud.setDeadEnd(true);
    expect(el('progress-value').textContent).toBe('');
    expect(el('progress-label').textContent).toBe('Dead end — drag back');
    expect(el('progress').classList.contains('progress--warn')).toBe(true);

    hud.setDeadEnd(false);
    expect(el('progress-value').textContent).toBe('7');
    expect(el('progress').classList.contains('progress--warn')).toBe(false);
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
