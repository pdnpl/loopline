/**
 * Canvas colours.
 *
 * Page chrome is themed in CSS; this palette is only for what the renderer
 * draws, because canvas cannot read CSS custom properties directly.
 */

export type ThemePreference = 'auto' | 'dark' | 'light';
export type ThemeName = 'dark' | 'light';

export interface Palette {
  /** Undrawn edges — present but quiet. */
  edgeGhost: string;
  /** Dots not yet reached. */
  nodeIdle: string;
  nodeIdleGlow: string;
  /** Dots the stroke has passed through. */
  nodeVisited: string;
  nodeVisitedGlow: string;
  /** The stroke runs through these three stops, start to tip. */
  strokeStart: string;
  strokeMid: string;
  strokeEnd: string;
  strokeGlow: string;
  /** Leading tip of the stroke. */
  head: string;
  /** Ring shown on possible starting dots when a hint is due. */
  hint: string;
  /** Current dot when every edge leaving it is already drawn. */
  deadEnd: string;
  particle: string;
  /**
   * Whether glow passes composite additively. Additive light reads as glow on a
   * dark board; on a light board it only washes the colour out, so the light
   * palette layers translucent ink instead.
   */
  additiveGlow: boolean;
}

const DARK: Palette = {
  edgeGhost: 'rgba(148, 163, 184, 0.17)',
  nodeIdle: 'rgba(148, 163, 184, 0.62)',
  nodeIdleGlow: 'rgba(148, 163, 184, 0.18)',
  nodeVisited: '#F1F5F9',
  nodeVisitedGlow: 'rgba(165, 180, 252, 0.55)',
  strokeStart: '#5EEAD4',
  strokeMid: '#818CF8',
  strokeEnd: '#E879F9',
  strokeGlow: 'rgba(129, 140, 248, 0.40)',
  head: '#FFFFFF',
  hint: 'rgba(94, 234, 212, 0.85)',
  deadEnd: '#FB7185',
  particle: '#A5B4FC',
  additiveGlow: true,
};

const LIGHT: Palette = {
  edgeGhost: 'rgba(71, 85, 105, 0.20)',
  nodeIdle: 'rgba(71, 85, 105, 0.55)',
  nodeIdleGlow: 'rgba(100, 116, 139, 0.16)',
  nodeVisited: '#0F172A',
  nodeVisitedGlow: 'rgba(99, 102, 241, 0.35)',
  strokeStart: '#0D9488',
  strokeMid: '#4F46E5',
  strokeEnd: '#C026D3',
  strokeGlow: 'rgba(79, 70, 229, 0.22)',
  head: '#020617',
  hint: '#0D9488',
  deadEnd: '#E11D48',
  particle: '#6366F1',
  additiveGlow: false,
};

export function palette(theme: ThemeName): Palette {
  return theme === 'light' ? LIGHT : DARK;
}

export function resolveTheme(preference: ThemePreference): ThemeName {
  if (preference !== 'auto') return preference;
  const prefersLight =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark';
}
