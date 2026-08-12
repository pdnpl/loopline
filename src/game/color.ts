/** Minimal colour helpers for the canvas — hex and rgb/rgba only. */

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parse(color: string): Rgb {
  const value = color.trim();

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const parts = value
    .slice(value.indexOf('(') + 1, value.lastIndexOf(')'))
    .split(',')
    .map((part) => Number.parseFloat(part));

  return {
    r: parts[0] || 0,
    g: parts[1] || 0,
    b: parts[2] || 0,
    a: parts.length > 3 ? parts[3] : 1,
  };
}

/** Returns the colour with its alpha multiplied by `factor`. */
export function withAlpha(color: string, factor: number): string {
  const { r, g, b, a } = parse(color);
  const alpha = Math.max(0, Math.min(1, a * factor));
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(3)})`;
}
