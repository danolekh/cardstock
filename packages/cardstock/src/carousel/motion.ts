/* The track's movement, outside React: where it stands (in slides, fractional while it moves), how
 * fast, and whether a finger holds it. Parts subscribe and write their own CSS variables, so a
 * frame never re-renders anything. */
import { cubicBezier } from "../utils/progress";
import { DEFAULT_SPRING, isSettled, type SpringConfig, stepSpring } from "./physics";

export interface PositionStore {
  get: () => number;
  subscribe: (listener: (position: number) => void) => () => void;
}

export interface Store<T> {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
}

export interface CarouselMotion {
  position: PositionStore;
  dragging: Store<boolean>;
  /** Moves the track at once (a drag, or a jump). */
  publish: (position: number) => void;
  /** Glides to `target`: on the spring carrying `velocity` (slides/s), on a short ease with
   * `reduced`, or at once with `snap: false`. */
  settleTo: (
    target: number,
    velocity: number,
    options: { snap: SpringConfig | false; reduced: boolean },
  ) => void;
  cancel: () => void;
  setDragging: (dragging: boolean) => void;
}

const easeOut = cubicBezier([0.23, 1, 0.32, 1]);

export function createCarouselMotion(initial: number): CarouselMotion {
  let position = initial;
  let velocity = 0;
  let frame = 0;
  let dragging = false;
  const listeners = new Set<(p: number) => void>();
  const dragListeners = new Set<() => void>();

  const publish = (p: number) => {
    position = p;
    for (const listener of listeners) listener(p);
  };
  const cancel = () => cancelAnimationFrame(frame);

  return {
    position: {
      get: () => position,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    dragging: {
      get: () => dragging,
      subscribe: (listener) => {
        dragListeners.add(listener);
        return () => dragListeners.delete(listener);
      },
    },
    publish,
    cancel,
    setDragging: (next) => {
      if (next === dragging) return;
      dragging = next;
      for (const listener of dragListeners) listener();
    },
    settleTo: (target, carried, { snap, reduced }) => {
      cancel();
      if (snap === false || position === target) {
        velocity = 0;
        return publish(target);
      }
      if (reduced) {
        // Reduced motion: a short ease-out slide, no spring and no carried speed.
        const from = position;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 200);
          publish(from + (target - from) * easeOut(t));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return;
      }
      velocity = carried;
      let last = performance.now();
      const spring = snap ?? DEFAULT_SPRING;
      const tick = (now: number) => {
        const dt = Math.min(0.064, Math.max(0, now - last) / 1000);
        last = now;
        const [x, v] = stepSpring(position, velocity, target, spring, dt);
        velocity = v;
        if (isSettled(x, v, target)) {
          velocity = 0;
          return publish(target);
        }
        publish(x);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
  };
}
