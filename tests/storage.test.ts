// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bestFor, load, recordBest, save } from '../src/game/storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts from sane defaults', () => {
    const data = load();
    expect(data).toEqual({
      version: 1,
      level: 1,
      best: {},
      lang: null,
      theme: 'auto',
      introSeen: false,
    });
  });

  it('round-trips through localStorage', () => {
    const data = load();
    data.level = 7;
    data.lang = 'pl';
    data.theme = 'light';
    data.introSeen = true;
    recordBest(data, 7, 4210);
    save(data);

    expect(load()).toEqual(data);
  });

  it('falls back to defaults on corrupt data', () => {
    localStorage.setItem('loopline:v1', '{not json');
    expect(load().level).toBe(1);

    localStorage.setItem('loopline:v1', '"a string"');
    expect(load().level).toBe(1);
  });

  it('rejects out-of-range values from a tampered payload', () => {
    localStorage.setItem(
      'loopline:v1',
      JSON.stringify({ version: 1, level: -4, lang: 'de', theme: 'neon', best: null }),
    );
    const data = load();
    expect(data.level).toBe(1);
    expect(data.lang).toBeNull();
    expect(data.theme).toBe('auto');
    expect(data.best).toEqual({});
  });

  it('keeps only the fastest time per level', () => {
    const data = load();
    expect(recordBest(data, 3, 9000)).toBe(true);
    expect(recordBest(data, 3, 9500)).toBe(false);
    expect(recordBest(data, 3, 8100)).toBe(true);
    expect(bestFor(data, 3)).toBe(8100);
    expect(bestFor(data, 4)).toBeNull();
  });

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => load()).not.toThrow();
    expect(load().level).toBe(1);
    expect(() => {
      save(load());
    }).not.toThrow();
  });
});
