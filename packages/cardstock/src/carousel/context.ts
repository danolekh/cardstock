"use client";
import type * as React from "react";
import { createContext, useContext } from "react";

export interface PositionStore {
  get: () => number;
  subscribe: (listener: (position: number) => void) => () => void;
}

export interface CarouselContextValue {
  index: number;
  count: number;
  setIndex: (index: number) => void;
  /** The fractional position of the track, updated every frame. */
  position: PositionStore;
  register: (index: number) => () => void;
  dragging: boolean;
  drag: {
    start: () => void;
    /** Move the track to `position` (already rubber-banded). */
    move: (position: number) => void;
    /** Let go at `velocity` slides/s; `flickVelocity` in slides/s. */
    end: (velocity: number, flickVelocity: number) => void;
  };
}

export const CarouselContext: React.Context<CarouselContextValue | null> =
  createContext<CarouselContextValue | null>(null);

/** The carousel's state, for building your own parts. */
export function useCardCarousel(): CarouselContextValue {
  const context = useContext(CarouselContext);
  if (!context) throw new Error("cardstock: carousel parts must be rendered inside <CardCarousel.Root>.");
  return context;
}
