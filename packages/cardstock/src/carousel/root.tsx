"use client";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../utils/media";
import { type PartProps, usePart } from "../utils/part";
import { cubicBezier } from "../utils/progress";
import { useControllableState } from "../utils/use-controllable-state";
import { CarouselContext, type CarouselContextValue, type PositionStore } from "./context";
import { DEFAULT_SPRING, isSettled, type SpringConfig, snapTarget, stepSpring } from "./physics";

export interface CardCarouselRootState extends Record<string, unknown> {
  dragging: boolean;
}

export interface CardCarouselRootProps extends PartProps<"div", CardCarouselRootState> {
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** The spring the track settles with, carrying the speed of the release; `false` jumps. */
  snap?: SpringConfig | false;
}

const easeOut = cubicBezier([0.23, 1, 0.32, 1]);

/** Holds the carousel's index and moves its track. The position (in slides, fractional while it
 * moves) is written as `--carousel-position` on this element every frame, and each slide gets its
 * own offset from it. Renders a `<div>`. */
export function CardCarouselRoot(props: CardCarouselRootProps): React.ReactElement {
  const { index: indexProp, defaultIndex = 0, onIndexChange, snap = DEFAULT_SPRING, ...rest } = props;
  const [index, setIndexState] = useControllableState({
    value: indexProp,
    defaultValue: defaultIndex,
    onChange: onIndexChange,
  });
  const [indices, setIndices] = useState<ReadonlySet<number>>(new Set());
  const count = indices.size;
  const [dragging, setDragging] = useState(false);
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // The moving position lives outside React: parts subscribe and write their own CSS variables.
  const motion = useRef({ position: index, velocity: 0, target: index, frame: 0, releaseVelocity: 0 });
  const listeners = useRef(new Set<(p: number) => void>());
  const publish = useCallback((p: number) => {
    motion.current.position = p;
    ref.current?.style.setProperty("--carousel-position", String(p));
    for (const listener of listeners.current) listener(p);
  }, []);
  const store = useMemo<PositionStore>(
    () => ({
      get: () => motion.current.position,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [],
  );

  const settleTo = useCallback(
    (target: number, velocity: number) => {
      const m = motion.current;
      cancelAnimationFrame(m.frame);
      m.target = target;
      if (snap === false) return publish(target);
      if (reduced) {
        // Reduced motion: a short ease-out slide, no spring and no carried speed.
        const from = m.position;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 200);
          publish(from + (target - from) * easeOut(t));
          if (t < 1) m.frame = requestAnimationFrame(tick);
        };
        m.frame = requestAnimationFrame(tick);
        return;
      }
      m.velocity = velocity;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.064, (now - last) / 1000);
        last = now;
        const [x, v] = stepSpring(m.position, m.velocity, target, snap, dt);
        m.velocity = v;
        if (isSettled(x, v, target)) {
          m.velocity = 0;
          return publish(target);
        }
        publish(x);
        m.frame = requestAnimationFrame(tick);
      };
      m.frame = requestAnimationFrame(tick);
    },
    [publish, reduced, snap],
  );

  // Every index change, from a drag, a key, a button or the owner, glides there.
  useEffect(() => {
    settleTo(index, motion.current.releaseVelocity);
    motion.current.releaseVelocity = 0;
  }, [index, settleTo]);
  useEffect(() => () => cancelAnimationFrame(motion.current.frame), []);

  const setIndex = useCallback(
    (next: number) => setIndexState(Math.max(0, Math.min(Math.max(0, count - 1), next))),
    [count, setIndexState],
  );

  const context = useMemo<CarouselContextValue>(
    () => ({
      index,
      count,
      setIndex,
      position: store,
      dragging,
      register: (i) => {
        setIndices((s) => new Set(s).add(i));
        return () =>
          setIndices((s) => {
            const next = new Set(s);
            next.delete(i);
            return next;
          });
      },
      drag: {
        start: () => {
          cancelAnimationFrame(motion.current.frame);
          setDragging(true);
        },
        move: publish,
        end: (velocity, flickVelocity) => {
          setDragging(false);
          const target = snapTarget({
            position: motion.current.position,
            velocity,
            index,
            count,
            flickVelocity,
          });
          if (target === index) settleTo(index, velocity);
          else {
            motion.current.releaseVelocity = velocity;
            setIndex(target);
          }
        },
      },
    }),
    [index, count, setIndex, store, dragging, publish, settleTo],
  );

  const element = usePart(
    "carousel",
    "div",
    { dragging },
    rest,
    { style: { "--carousel-position": index } as React.CSSProperties },
    [ref as React.Ref<never>],
  );
  return <CarouselContext.Provider value={context}>{element}</CarouselContext.Provider>;
}
