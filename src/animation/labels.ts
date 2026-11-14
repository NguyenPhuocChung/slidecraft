/**
 * Plain-language labels + one-line explanations for animations and transitions.
 * English source strings here are translated in src/i18n/vi/editor.ts so a person
 * who reads no English understands every option.
 */
import type { AnimationCategory } from '@/types/registry';

export const CATEGORY_LABEL: Record<AnimationCategory, string> = { entrance: 'Entrance', emphasis: 'Emphasis', exit: 'Exit animation', motion: 'Motion path' };
export const CATEGORY_HELP: Record<AnimationCategory, string> = {
  entrance: 'How the object appears on the slide',
  emphasis: 'Draws attention to an object that is already visible',
  exit: 'How the object disappears from the slide',
  motion: 'Moves the object along a path',
};

export const TRIGGER_LABEL: Record<string, string> = {
  onClick: 'On mouse click',
  withPrevious: 'Together with the previous effect',
  afterPrevious: 'After the previous effect',
  onEnter: 'Automatically when the slide opens',
  onExit: 'When leaving the slide',
};
export const TRIGGER_SHORT: Record<string, string> = { onClick: 'click', withPrevious: 'with', afterPrevious: 'after', onEnter: 'enter', onExit: 'leave' };

export const EASING_LABEL: Record<string, string> = {
  linear: 'Steady speed',
  ease: 'Smooth motion',
  easeIn: 'Speeds up',
  easeOut: 'Slows down',
  easeInOut: 'Slow – fast – slow',
  spring: 'Springy',
  bounce: 'Bouncy',
  backOut: 'Overshoot then settle',
};

/** What a direction means for a given effect (wipe "left" = reveals from left to right, etc.). */
export function directionLabel(effect: string, d: string): string {
  if (d === 'horizontal') return 'Horizontal';
  if (d === 'vertical') return 'Vertical';
  if (effect === 'flyOut') return ({ left: 'To the left', right: 'To the right', up: 'To the top', down: 'To the bottom' } as Record<string, string>)[d] ?? d;
  if (effect === 'floatIn') return d === 'up' ? 'Upward' : d === 'down' ? 'Downward' : d;
  if (['wipe', 'reveal', 'draw', 'wipeOut'].includes(effect)) return ({ left: 'Left to right', right: 'Right to left', up: 'Bottom to top', down: 'Top to bottom' } as Record<string, string>)[d] ?? d;
  return ({ left: 'From the left', right: 'From the right', up: 'From the top', down: 'From the bottom' } as Record<string, string>)[d] ?? d;
}

export const EFFECT_HELP: Record<string, string> = {
  fadeIn: 'The object starts invisible and slowly becomes clear',
  appear: 'The object shows up instantly, no movement',
  flyIn: 'The object flies in from outside the slide',
  floatIn: 'The object drifts in gently while fading in',
  zoomIn: 'The object grows from small to its full size',
  grow: 'The object grows out from its centre',
  wipe: 'The object is revealed gradually, like wiping a window',
  split: 'The object opens from the middle outwards',
  rise: 'The object rises up softly into place',
  bounce: 'The object drops in and bounces a little',
  blurIn: 'The object goes from blurry to sharp',
  rotateIn: 'The object spins while appearing',
  flipIn: 'The object flips over like a card',
  reveal: 'The object slides in slightly while being revealed',
  typewriter: 'Text appears letter by letter, like typing',
  draw: 'Lines and arrows are drawn as if by a pen',
  pop: 'The object pops out quickly with a small bounce',
  pulse: 'The object briefly gets bigger then returns, like a heartbeat',
  growShrink: 'The object grows (or shrinks) and stays that size',
  spin: 'The object turns one full circle',
  teeter: 'The object rocks left and right',
  transparency: 'The object becomes see-through',
  colorChange: 'The object changes to another colour',
  flash: 'The object blinks quickly',
  shake: 'The object shakes quickly to draw attention',
  highlight: 'The object gets slightly bigger to stand out',
  fadeOut: 'The object slowly fades away',
  flyOut: 'The object flies off the slide',
  zoomOut: 'The object shrinks and disappears',
  shrink: 'The object shrinks towards its centre and disappears',
  collapse: 'The object closes towards the middle',
  wipeOut: 'The object is wiped away gradually',
  rotateOut: 'The object spins while disappearing',
  blurOut: 'The object becomes blurry and disappears',
  motionLine: 'The object moves in a straight line',
  motionCurve: 'The object moves along a curve',
  motionCircle: 'The object moves around a circle',
  motionPath: 'The object follows a path you draw (SVG)',
};

export const TRANSITION_HELP: Record<string, string> = {
  none: 'The next slide appears immediately',
  fade: 'The old slide fades out as the new one fades in',
  dissolve: 'The new slide appears in small speckles',
  push: 'The new slide pushes the old one off screen',
  wipe: 'The new slide is wiped over the old one',
  split: 'The new slide opens from the middle',
  reveal: 'The old slide slides away to reveal the new one',
  cover: 'The new slide slides in on top of the old one',
  uncover: 'The old slide slides away, uncovering the new one',
  zoom: 'The new slide zooms in',
  morph: 'Objects with the same id glide smoothly to their new position, size and colour',
  cube: 'The slides turn like the faces of a cube',
  flip: 'The slide flips over like a card',
  gallery: 'Slides move like photos in a gallery',
  randomBars: 'The new slide appears in random stripes',
  blinds: 'The new slide appears like opening window blinds',
  checkerboard: 'The new slide appears in a checkerboard pattern',
};

export const SOUND_LABEL: Record<string, string> = { none: 'No sound', click: 'Click sound', whoosh: 'Whoosh', chime: 'Chime' };
export const supportLabel = (lvl: string | undefined) => (lvl === 'supported' ? 'PowerPoint: full support' : lvl === 'partial' ? 'PowerPoint: partial support' : 'PowerPoint: web only');
