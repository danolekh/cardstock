"use client";
import type * as React from "react";
import { createContext, useContext } from "react";

import type { Progress, Walk } from "../utils/progress";

export interface CardContextValue {
  flipped: boolean;
  frozen: boolean;
  /** Details are showing. Always false while frozen. */
  revealed: boolean;
  setFlipped: (flipped: boolean) => void;
  setFrozen: (frozen: boolean) => void;
  setRevealed: (revealed: boolean) => void;
  /** 0..1 as the details reveal; drives the scramble. */
  reveal: Progress;
  /** 0..1 as the card freezes; drives `<Frost />`. */
  freeze: Progress;
  revealTiming: Walk;
  reducedMotion: boolean;
}

export const CardContext: React.Context<CardContextValue | null> = createContext<CardContextValue | null>(
  null,
);

/** The card's state and setters, for building your own parts or driving your own animation. */
export function useCard(): CardContextValue {
  const context = useContext(CardContext);
  if (!context) throw new Error("cardstock: card parts must be rendered inside <Card.Root>.");
  return context;
}
