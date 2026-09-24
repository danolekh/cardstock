"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

export type Easing = "linear" | readonly [number, number, number, number];

/** How a progress value travels: seconds for a full walk each way, and the curve. */
export interface Walk {
  show: number;
  hide: number;
  ease?: Easing;
}

/** CSS `cubic-bezier()` as a function of time, solved by Newton steps with a bisection fallback. */
export function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]): (
  t: number,
) => number {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return (x) => {
    if (x <= 0 || x >= 1) return x;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= (at(t, x1, x2) - x) / d;
    }
    if (t < 0 || t > 1 || Math.abs(at(t, x1, x2) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let i = 0; i < 30; i++) {
        if (at(t, x1, x2) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return at(t, y1, y2);
  };
}

/** A number between 0 and 1 that parts subscribe to. It walks towards its target over time; a
 * new target mid-way turns it around from where it stands, so the animation it drives reverses
 * instead of restarting. */
export class Progress {
  #value: number;
  #listeners = new Set<(value: number) => void>();
  #frame = 0;

  constructor(value: number) {
    this.#value = value;
  }

  get(): number {
    return this.#value;
  }

  subscribe(listener: (value: number) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  jump(value: number): void {
    cancelAnimationFrame(this.#frame);
    this.#set(value);
  }

  walkTo(target: number, walk: Walk): void {
    cancelAnimationFrame(this.#frame);
    const from = this.#value;
    const distance = Math.abs(target - from);
    const duration = (target > from ? walk.show : walk.hide) * distance * 1000;
    if (distance === 0 || duration <= 0) return this.#set(target);
    const ease = walk.ease && walk.ease !== "linear" ? cubicBezier(walk.ease) : (t: number) => t;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      this.#set(from + (target - from) * ease(t));
      if (t < 1) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.#frame);
  }

  #set(value: number) {
    this.#value = value;
    for (const listener of this.#listeners) listener(value);
  }
}

/** A Progress that follows `on`, jumping instead of walking when `instant` (reduced motion). */
export function useProgress(on: boolean, walk: Walk, instant: boolean): Progress {
  const [progress] = useState(() => new Progress(on ? 1 : 0));
  const { show, hide, ease } = walk;
  // A curve passed inline is a new array each render; compare it by value.
  const curve = typeof ease === "string" || !ease ? ease : ease.join();
  useEffect(() => {
    const target = on ? 1 : 0;
    if (instant) progress.jump(target);
    else progress.walkTo(target, { show, hide, ease });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `ease` is compared through `curve`
  }, [on, instant, show, hide, curve, progress]);
  useEffect(() => () => progress.stop(), [progress]);
  return progress;
}

/** The current value of a Progress as React state (re-renders on every change). */
export function useProgressValue(progress: Progress): number {
  return useSyncExternalStore(
    (onChange) => progress.subscribe(onChange),
    () => progress.get(),
    () => progress.get(),
  );
}
