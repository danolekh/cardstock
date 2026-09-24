"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { usePresence } from "../utils/presence";
import { useCard } from "./context";

export interface CardFrozenOverlayState extends Record<string, unknown> {
  open: boolean;
}
export interface CardFrozenOverlayProps extends PartProps<"div", CardFrozenOverlayState> {
  /** Keep it in the DOM while the card isn't frozen (then style `[data-open]` yourself). */
  keepMounted?: boolean;
}

/** Shown while the card is frozen: a place for your own frost, lock or tint. Like Base UI popups
 * it carries `data-starting-style` on its first frame and `data-ending-style` while it leaves,
 * and waits for your CSS transitions or animations to finish before it unmounts. Renders a
 * `<div>`. */
export function CardFrozenOverlay(props: CardFrozenOverlayProps): React.ReactElement | null {
  const { keepMounted = false, ...rest } = props;
  const { frozen } = useCard();
  const { phase, ref, attributes } = usePresence(frozen);
  const element = usePart(
    "card-frozen-overlay",
    "div",
    { open: frozen },
    rest,
    { "aria-hidden": true, ...attributes },
    [ref as React.Ref<never>],
  );
  return phase !== "closed" || keepMounted ? element : null;
}
