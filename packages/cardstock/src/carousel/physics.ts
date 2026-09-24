/** Carousel physics in slide units (1 = one slide), as pure functions. */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

/** A tuned default: settles in about 400ms with no visible bounce. */
export const DEFAULT_SPRING: SpringConfig = { stiffness: 320, damping: 34, mass: 1 };

/** Advances a damped spring by `dt` seconds (semi-implicit Euler, in 1/240s substeps). */
export function stepSpring(
  position: number,
  velocity: number,
  target: number,
  { stiffness, damping, mass = 1 }: SpringConfig,
  dt: number,
): [position: number, velocity: number] {
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  let x = position;
  let v = velocity;
  for (let i = 0; i < steps; i++) {
    const a = (-stiffness * (x - target) - damping * v) / mass;
    v += a * h;
    x += v * h;
  }
  return [x, v];
}

export const isSettled = (position: number, velocity: number, target: number): boolean =>
  Math.abs(position - target) < 5e-4 && Math.abs(velocity) < 5e-3;

/** Past either end the track moves at a fraction of the finger: the rubber band. */
export function rubberBand(position: number, count: number, elastic = 0.18): number {
  const max = Math.max(0, count - 1);
  if (position < 0) return position * elastic;
  if (position > max) return max + (position - max) * elastic;
  return position;
}

export interface SnapInput {
  /** Where the track stands, in slides (0 = first). */
  position: number;
  /** Release speed in slides per second, positive towards later slides. */
  velocity: number;
  /** The slide it started from. */
  index: number;
  count: number;
  /** Speed that counts as a flick even when the drag was short. */
  flickVelocity: number;
  /** How far ahead the release speed carries the landing point, in seconds. */
  projection?: number;
}

/** The slide a release lands on: the nearest one to where the speed would carry the track, never
 * more than one away, and a flick always moves one. */
export function snapTarget({
  position,
  velocity,
  index,
  count,
  flickVelocity,
  projection = 0.2,
}: SnapInput): number {
  let target = Math.round(position + velocity * projection);
  if (target === index && Math.abs(velocity) > flickVelocity) target = index + Math.sign(velocity);
  target = Math.max(index - 1, Math.min(index + 1, target));
  return Math.max(0, Math.min(count - 1, target));
}
