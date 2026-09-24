"use client";
import type * as React from "react";
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { usePrefersReducedMotion } from "../utils/media";
import { type PartProps, usePart } from "../utils/part";
import { useControllableState } from "../utils/use-controllable-state";
import { useIsoLayoutEffect } from "../utils/use-iso-layout-effect";
import {
  CarouselContext,
  type CarouselContextValue,
  CarouselMotionContext,
  type CarouselMotionContextValue,
} from "./context";
import { type CarouselEffect, effectVars } from "./effect";
import { type CardCarouselLabels, DEFAULT_CAROUSEL_LABELS } from "./labels";
import { createCarouselMotion } from "./motion";
import { DEFAULT_SPRING, type SpringConfig, snapTarget } from "./physics";

export interface CardCarouselRootState extends Record<string, unknown> {
  dragging: boolean;
  index: number;
  effect: CarouselEffect;
}

export interface CardCarouselRootProps extends PartProps<"div", CardCarouselRootState> {
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** How many slides there are. Optional: the track counts its own. Give it when server-rendered
   * HTML should already disable Previous on the first slide and Next on the last. */
  count?: number;
  /** The built-in look (`"coverflow"`), or `"none"` to write only the CSS variables and style
   * the slides yourself. */
  effect?: CarouselEffect;
  /** Space between slides, in px. The drag moves one slide per slide width plus this. */
  gap?: number;
  /** How far the cards beside the middle one turn away, 0 (flat) to 1 and beyond. */
  turn?: number;
  /** Scale a neighbour loses, 0..1. */
  depth?: number;
  /** Opacity a neighbour loses, 0..1. */
  fade?: number;
  /** The spring the track settles with, carrying the speed of the release; `false` jumps. */
  snap?: SpringConfig | false;
  /** Speed in px/s that counts as a flick, so a short fast swipe still moves one slide. */
  flickVelocity?: number;
  /** Share of the finger's travel the track follows past either end. */
  elastic?: number;
  /** Which way slides run. By default it follows the page's `direction`. */
  dir?: "ltr" | "rtl";
  /** What assistive tech reads out; translate them here. */
  labels?: Partial<CardCarouselLabels>;
}

/** Holds the carousel's index and moves its track. The position (in slides, fractional while it
 * moves) is written as `--carousel-position` on this element every frame, and each slide gets its
 * own offset from it. With the default `effect`, the slides are laid out as a coverflow from
 * those; the tuning is on this element as `--carousel-gap`, `--carousel-turn`, `--carousel-depth`,
 * `--carousel-fade` and `--carousel-direction`. Renders a `<div>`. */
export function CardCarouselRoot(props: CardCarouselRootProps): React.ReactElement {
  const {
    index: indexProp,
    defaultIndex = 0,
    onIndexChange,
    count: countProp,
    effect = "coverflow",
    gap = 20,
    turn = 1,
    depth = 0.1,
    fade = 0.4,
    snap = DEFAULT_SPRING,
    flickVelocity = 500,
    elastic = 0.18,
    dir: dirProp,
    labels: labelsProp,
    ...rest
  } = props;
  const [index, setIndexState] = useControllableState({
    value: indexProp,
    defaultValue: defaultIndex,
    onChange: onIndexChange,
  });
  const [counted, setCounted] = useState<number | undefined>(undefined);
  const count = countProp ?? counted;
  const [tabs, setTabs] = useState(false);
  const [pageDir, setPageDir] = useState<"ltr" | "rtl">("ltr");
  const dir = dirProp ?? pageDir;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [motion] = useState(() => createCarouselMotion(index));
  const dragging = useSyncExternalStore(motion.dragging.subscribe, motion.dragging.get, () => false);
  const pending = useRef(0); // release speed the next glide carries
  const id = useId();

  // The moving position never goes through React: set once, then written every frame.
  const [initialStyle] = useState(() => ({ "--carousel-position": index }) as React.CSSProperties);
  useIsoLayoutEffect(() => {
    const write = (p: number) => ref.current?.style.setProperty("--carousel-position", String(p));
    write(motion.position.get());
    return motion.position.subscribe(write);
  }, [motion]);

  useIsoLayoutEffect(() => {
    if (!dirProp && ref.current)
      setPageDir(getComputedStyle(ref.current).direction === "rtl" ? "rtl" : "ltr");
  }, [dirProp]);

  // Every index change, from a drag, a key, a button or the owner, glides there, starting before
  // the frame that shows the new index.
  const settle = useRef({ snap, reduced });
  useIsoLayoutEffect(() => {
    settle.current = { snap, reduced };
  });
  useIsoLayoutEffect(() => {
    motion.settleTo(index, pending.current, settle.current);
    pending.current = 0;
  }, [index, motion]);
  useIsoLayoutEffect(() => () => motion.cancel(), [motion]);

  const setIndex = useCallback(
    (next: number) => setIndexState(Math.max(0, count === undefined ? next : Math.min(count - 1, next))),
    [count, setIndexState],
  );

  // Fewer slides than the index points past: land on the last one.
  useIsoLayoutEffect(() => {
    if (count !== undefined && count > 0 && index > count - 1) setIndexState(count - 1);
  }, [count, index, setIndexState]);

  // What the gesture's release reads, kept current without re-creating the motion context.
  const live = useRef({ index, count, setIndex });
  useIsoLayoutEffect(() => {
    live.current = { index, count, setIndex };
  });
  const motionContext = useMemo<CarouselMotionContextValue>(() => {
    const slides = new Map<number, { el: HTMLElement; selectOnClick: boolean }>();
    return {
      motion,
      gap,
      flickVelocity,
      elastic,
      slides,
      setCount: setCounted,
      setTabs,
      registerSlide: (i, el, selectOnClick) => {
        slides.set(i, { el, selectOnClick });
        return () => {
          if (slides.get(i)?.el === el) slides.delete(i);
        };
      },
      release: (velocity, flick) => {
        const { index: current, count: n, setIndex: go } = live.current;
        const target = snapTarget({
          position: motion.position.get(),
          velocity,
          index: current,
          count: n ?? current + 2,
          flickVelocity: flick,
        });
        if (target === current) motion.settleTo(current, velocity, settle.current);
        else {
          pending.current = velocity;
          go(target);
        }
      },
    };
  }, [motion, gap, flickVelocity, elastic]);

  const context = useMemo<CarouselContextValue>(
    () => ({
      index,
      count,
      setIndex,
      dir,
      effect,
      tabs,
      labels: { ...DEFAULT_CAROUSEL_LABELS, ...labelsProp },
      slideId: (i) => `${id}-slide-${i}`,
      tabId: (i) => `${id}-tab-${i}`,
    }),
    [index, count, setIndex, dir, effect, tabs, id, labelsProp],
  );

  const element = usePart(
    "carousel",
    "div",
    { dragging, index, effect },
    rest,
    {
      "data-dir": dir,
      style: {
        ...initialStyle,
        ...effectVars({
          gap,
          // Reduced motion keeps the fade, but nothing turns or recedes.
          turn: reduced ? 0 : turn,
          depth: reduced ? 0 : depth,
          fade,
          direction: dir === "rtl" ? -1 : 1,
        }),
      },
    },
    [ref as React.Ref<never>],
  );
  return (
    <CarouselMotionContext.Provider value={motionContext}>
      <CarouselContext.Provider value={context}>{element}</CarouselContext.Provider>
    </CarouselMotionContext.Provider>
  );
}
