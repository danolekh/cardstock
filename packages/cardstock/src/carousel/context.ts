"use client";
import type * as React from "react";
import { createContext, useContext, useSyncExternalStore } from "react";

import type { CarouselEffect } from "./effect";
import type { CardCarouselLabels } from "./labels";
import type { CarouselMotion, PositionStore } from "./motion";

export type { PositionStore } from "./motion";

/** The carousel's state. It changes when the index or the count does, never per frame. */
export interface CarouselContextValue {
  index: number;
  /** Slides counted. `undefined` only while server-rendering without a `count` on the root. */
  count: number | undefined;
  setIndex: (index: number) => void;
  dir: "ltr" | "rtl";
  labels: CardCarouselLabels;
  effect: CarouselEffect;
  /** Ids that tie indicators (tabs) to slides (their panels). */
  slideId: (index: number) => string;
  tabId: (index: number) => string;
  /** Indicators are mounted, so slides are tab panels. */
  tabs: boolean;
}

/** What never changes for the carousel's lifetime: the moving track and the gesture's hooks. */
export interface CarouselMotionContextValue {
  motion: CarouselMotion;
  gap: number;
  flickVelocity: number;
  elastic: number;
  setCount: (count: number) => void;
  setTabs: (tabs: boolean) => void;
  registerSlide: (index: number, el: HTMLElement, selectOnClick: boolean) => () => void;
  slides: Map<number, { el: HTMLElement; selectOnClick: boolean }>;
  /** Called on release with speed in slides/s. */
  release: (velocity: number, flickVelocity: number) => void;
}

export const CarouselContext: React.Context<CarouselContextValue | null> =
  createContext<CarouselContextValue | null>(null);
export const CarouselMotionContext: React.Context<CarouselMotionContextValue | null> =
  createContext<CarouselMotionContextValue | null>(null);

/** The index Track gives each of its children, from their order. */
export const SlideIndexContext: React.Context<number | undefined> = createContext<number | undefined>(
  undefined,
);
/** The slide count Track knows while rendering, before the root has heard it. */
export const TrackCountContext: React.Context<number | undefined> = createContext<number | undefined>(
  undefined,
);

export interface CarouselSlideState {
  index: number;
  count: number;
  active: boolean;
  /** Whole slides from the current one (`index - current`); the moving value is in CSS. */
  offset: number;
}
export const SlideContext: React.Context<CarouselSlideState | null> =
  createContext<CarouselSlideState | null>(null);

const outside = () => new Error("cardstock: carousel parts must be rendered inside <CardCarousel.Root>.");

/** The carousel's state, for building your own parts. */
export function useCardCarousel(): CarouselContextValue {
  const context = useContext(CarouselContext);
  if (!context) throw outside();
  return context;
}

export function useCarouselMotion(): CarouselMotionContextValue {
  const context = useContext(CarouselMotionContext);
  if (!context) throw outside();
  return context;
}

/** The track's position in slides, fractional while it moves. Subscribe to follow it every frame
 * without re-rendering. */
export function useCarouselPosition(): PositionStore {
  return useCarouselMotion().motion.position;
}

/** Whether a finger or mouse is dragging the track; re-renders only the component that asks. */
export function useCarouselDragging(): boolean {
  const { dragging } = useCarouselMotion().motion;
  return useSyncExternalStore(dragging.subscribe, dragging.get, () => false);
}

/** The slide this is rendered in: its index, whether it's current, and how far from the middle. */
export function useCarouselSlide(): CarouselSlideState {
  const context = useContext(SlideContext);
  if (!context) throw new Error("cardstock: useCarouselSlide() must be called inside <CardCarousel.Slide>.");
  return context;
}
