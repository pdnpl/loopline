/**
 * Just enough browser for the renderer and the game loop to run under jsdom.
 *
 * jsdom ships no 2D canvas context, no `Path2D` and no `ResizeObserver`, so the
 * pieces that only matter for pixels are stubbed while every code path — sprite
 * building, batching, gradients, the frame loop — still executes for real.
 */

export interface RecordedCall {
  name: string;
  args: unknown[];
}

export interface CanvasStub {
  calls: RecordedCall[];
  countOf(name: string): number;
  reset(): void;
}

const gradientStub = {
  addColorStop(): void {
    /* colours are irrelevant to the stub */
  },
};

function recordingContext(
  canvas: HTMLCanvasElement,
  calls: RecordedCall[],
): CanvasRenderingContext2D {
  const properties: Record<string, unknown> = {};

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, property) {
      if (property === 'canvas') return canvas;
      if (property in target) return target[property as string];
      return (...args: unknown[]): unknown => {
        calls.push({ name: String(property), args });
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
          return gradientStub;
        }
        return undefined;
      };
    },
    set(target, property, value) {
      target[property as string] = value;
      return true;
    },
    has() {
      return true;
    },
  };

  return new Proxy(properties, handler) as unknown as CanvasRenderingContext2D;
}

/** Replaces `getContext` so every drawing call is recorded instead of rasterised. */
export function stubCanvas(): CanvasStub {
  const calls: RecordedCall[] = [];

  HTMLCanvasElement.prototype.getContext = function stubbedGetContext(
    this: HTMLCanvasElement,
  ): CanvasRenderingContext2D {
    return recordingContext(this, calls);
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  class Path2DStub {
    moveTo(): void {
      /* geometry is exercised by the trail tests */
    }
    lineTo(): void {
      /* geometry is exercised by the trail tests */
    }
  }
  (globalThis as unknown as { Path2D: unknown }).Path2D = Path2DStub;

  return {
    calls,
    countOf(name: string): number {
      return calls.filter((call) => call.name === name).length;
    },
    reset(): void {
      calls.length = 0;
    },
  };
}

/** A `ResizeObserver` that never fires — the tests drive resizing explicitly. */
export function stubResizeObserver(): void {
  class ResizeObserverStub {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

export function stubMatchMedia(matches = false): void {
  (globalThis as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches,
    media: query,
    addEventListener(): void {
      /* no-op */
    },
    removeEventListener(): void {
      /* no-op */
    },
  });
}

/** Manual frame pump so tests advance time deterministically. */
export interface FramePump {
  advance(ms: number): void;
  restore(): void;
}

export function stubAnimationFrame(): FramePump {
  const original = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let pending: FrameRequestCallback | null = null;
  let clock = 0;
  let handle = 0;

  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    pending = callback;
    return ++handle;
  };
  globalThis.cancelAnimationFrame = (): void => {
    pending = null;
  };

  return {
    advance(ms: number): void {
      clock += ms;
      const callback = pending;
      pending = null;
      if (callback !== null) callback(clock);
    },
    restore(): void {
      globalThis.requestAnimationFrame = original;
      globalThis.cancelAnimationFrame = originalCancel;
    },
  };
}

/** jsdom has no `PointerEvent`; a `MouseEvent` with a pointer id is enough. */
export function pointerEvent(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

export interface PointerTargetOptions {
  /**
   * Make the pointer-capture calls throw, as browsers do when the pointer is
   * no longer active by the time the handler runs.
   */
  captureThrows?: boolean;
}

export interface PointerTarget {
  /** Changes the element's reported box, for testing resize handling. */
  resize(width: number, height: number): void;
}

/** Gives an element the pointer-capture API and a fixed on-screen box. */
export function preparePointerTarget(
  element: HTMLElement,
  width: number,
  height: number,
  options: PointerTargetOptions = {},
): PointerTarget {
  const captured = new Set<number>();
  Object.assign(element, {
    setPointerCapture(id: number): void {
      if (options.captureThrows === true) throw new Error('InvalidPointerId');
      captured.add(id);
    },
    releasePointerCapture(id: number): void {
      if (options.captureThrows === true) throw new Error('InvalidPointerId');
      captured.delete(id);
    },
    hasPointerCapture(id: number): boolean {
      if (options.captureThrows === true) throw new Error('InvalidPointerId');
      return captured.has(id);
    },
  });

  let box = { width, height };
  element.getBoundingClientRect = (): DOMRect => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: box.width,
    bottom: box.height,
    width: box.width,
    height: box.height,
    toJSON: () => ({}),
  });

  return {
    resize(nextWidth: number, nextHeight: number): void {
      box = { width: nextWidth, height: nextHeight };
    },
  };
}

/**
 * Marks an event as reporting no coalesced samples — what browsers do for
 * untrusted events and when high-frequency input is restricted.
 */
export function withEmptyCoalesced(event: Event): Event {
  Object.defineProperty(event, 'getCoalescedEvents', { value: (): Event[] => [] });
  return event;
}
