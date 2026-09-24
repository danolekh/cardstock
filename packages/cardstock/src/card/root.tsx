"use client";
import type * as React from "react";
import { useEffect, useMemo } from "react";

import { usePrefersReducedMotion } from "../utils/media";
import { type PartProps, usePart } from "../utils/part";
import { type Walk, useProgress } from "../utils/progress";
import { useControllableState } from "../utils/use-controllable-state";
import { CardContext, type CardContextValue } from "./context";

/** Under 300ms and easing out, so the first digits land at once; hiding is quicker still. */
export const REVEAL_TIMING: Walk = { show: 0.3, hide: 0.15, ease: [0.23, 1, 0.32, 1] };
/** The freeze is the one moment meant to be watched. */
export const FREEZE_TIMING: Walk = { show: 0.75, hide: 0.75 };

export interface CardRootState extends Record<string, unknown> {
  flipped: boolean;
  frozen: boolean;
  revealed: boolean;
}

export interface CardRootProps extends PartProps<"div", CardRootState> {
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  frozen?: boolean;
  defaultFrozen?: boolean;
  onFrozenChange?: (frozen: boolean) => void;
  /** Whether the details (number, security code) are showing. A frozen card never shows them. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Timing of the reveal progress that drives `Card.Number`'s scramble. */
  revealTiming?: Walk;
  /** Timing of the freeze progress that drives `<Frost />`. */
  freezeTiming?: Walk;
}

/** Holds a card's state and shares it with its parts. Renders a `<div>`. */
export function CardRoot(props: CardRootProps): React.ReactElement {
  const {
    flipped: flippedProp,
    defaultFlipped = false,
    onFlippedChange,
    frozen: frozenProp,
    defaultFrozen = false,
    onFrozenChange,
    revealed: revealedProp,
    defaultRevealed = false,
    onRevealedChange,
    revealTiming = REVEAL_TIMING,
    freezeTiming = FREEZE_TIMING,
    ...rest
  } = props;
  const [flipped, setFlipped] = useControllableState({
    value: flippedProp,
    defaultValue: defaultFlipped,
    onChange: onFlippedChange,
  });
  const [frozen, setFrozen] = useControllableState({
    value: frozenProp,
    defaultValue: defaultFrozen,
    onChange: onFrozenChange,
  });
  const [wantsReveal, setRevealed] = useControllableState({
    value: revealedProp,
    defaultValue: defaultRevealed,
    onChange: onRevealedChange,
  });
  const revealed = wantsReveal && !frozen;

  // Freezing hides the details, and says so, so a controlled owner doesn't keep a stale "shown".
  useEffect(() => {
    if (frozen && wantsReveal) setRevealed(false);
  }, [frozen, wantsReveal, setRevealed]);

  const reducedMotion = usePrefersReducedMotion();
  const reveal = useProgress(revealed, revealTiming, reducedMotion);
  const freeze = useProgress(frozen, freezeTiming, reducedMotion);

  const context = useMemo<CardContextValue>(
    () => ({
      flipped,
      frozen,
      revealed,
      setFlipped,
      setFrozen,
      setRevealed,
      reveal,
      freeze,
      revealTiming,
      reducedMotion,
    }),
    [
      flipped,
      frozen,
      revealed,
      setFlipped,
      setFrozen,
      setRevealed,
      reveal,
      freeze,
      revealTiming,
      reducedMotion,
    ],
  );
  const state: CardRootState = { flipped, frozen, revealed };
  const element = usePart("card", "div", state, rest, {});
  return <CardContext.Provider value={context}>{element}</CardContext.Provider>;
}
