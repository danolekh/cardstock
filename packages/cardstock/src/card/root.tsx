"use client";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { backgroundTone, type CardBackground, type Tone } from "../background/background";
import { usePrefersReducedMotion } from "../utils/media";
import { type PartProps, usePart } from "../utils/part";
import { type Walk, useProgress } from "../utils/progress";
import { useControllableState } from "../utils/use-controllable-state";
import { CardContext, type CardContextValue, createRevealGroupRegistry } from "./context";
import { type CardFlipOrigin, DEFAULT_ORIGIN } from "./flip";
import { useRevealTimeout } from "./reveal-group";
import type { CardStatus } from "./status";

/** Under 300ms and easing out, so the first digits land at once; hiding is quicker still. */
export const REVEAL_TIMING: Walk = { show: 0.3, hide: 0.15, ease: [0.23, 1, 0.32, 1] };
/** The freeze is the one moment meant to be watched. */
export const FREEZE_TIMING: Walk = { show: 0.75, hide: 0.75 };
/** The flip's length each way. The progress runs linearly; each flip style brings its own curve. */
export const FLIP_TIMING: Walk = { show: 0.75, hide: 0.75 };

export interface CardRootState extends Record<string, unknown> {
  flipped: boolean;
  frozen: boolean;
  revealed: boolean;
  status: CardStatus | undefined;
  /** The background's type, as `data-background`. */
  background: CardBackground["type"] | undefined;
  /** How the background reads, as `data-tone`: style light text on `dark`. */
  tone: Tone | undefined;
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
  /** Hide the details again this long after revealing them. Off by default. */
  revealTimeoutMs?: number;
  /** How the card stands, for display only (`data-status`, `Card.Status`). */
  status?: CardStatus;
  /** What the card is painted with, as data you can store. `Card.Background` paints it and
   * `<Frost />` draws it; `data-tone` tells your text which way to go. */
  background?: CardBackground;
  /** Timing of the reveal progress that drives `Card.Number`'s scramble. */
  revealTiming?: Walk;
  /** Timing of the freeze progress that drives `<Frost />`. */
  freezeTiming?: Walk;
  /** Timing of the flip progress that drives `Card.Body`. Keep it linear: the flip styles ease
   * it themselves. */
  flipTiming?: Walk;
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
    revealTimeoutMs,
    status,
    background,
    revealTiming = REVEAL_TIMING,
    freezeTiming = FREEZE_TIMING,
    flipTiming = FLIP_TIMING,
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
  useRevealTimeout(revealed, revealTimeoutMs, setRevealed);
  const [revealGroups] = useState(createRevealGroupRegistry);

  const reducedMotion = usePrefersReducedMotion();
  const reveal = useProgress(revealed, revealTiming, reducedMotion);
  const freeze = useProgress(frozen, freezeTiming, reducedMotion);
  const flip = useProgress(flipped, flipTiming, reducedMotion);
  const [flipOrigin] = useState(() => {
    let origin: CardFlipOrigin = DEFAULT_ORIGIN;
    return { get: () => origin, set: (next: CardFlipOrigin) => void (origin = next) };
  });

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
      flip,
      flipOrigin,
      revealTiming,
      reducedMotion,
      revealGroups,
      status,
      background,
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
      flip,
      flipOrigin,
      revealTiming,
      reducedMotion,
      revealGroups,
      status,
      background,
    ],
  );
  const state: CardRootState = {
    flipped,
    frozen,
    revealed,
    status,
    background: background?.type,
    tone: background ? backgroundTone(background) : undefined,
  };
  const element = usePart("card", "div", state, rest, {});
  return <CardContext.Provider value={context}>{element}</CardContext.Provider>;
}
