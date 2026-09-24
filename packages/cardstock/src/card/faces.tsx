"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";

export interface CardBodyState extends Record<string, unknown> {
  flipped: boolean;
}
export interface CardBodyProps extends PartProps<"div", CardBodyState> {}

/** The element that turns over. It sets `--card-flipped` (0 or 1) and `data-flipped`; the turn is
 * yours, e.g. `transform: rotateY(calc(var(--card-flipped) * 180deg))`. Renders a `<div>`. */
export function CardBody(props: CardBodyProps): React.ReactElement {
  const { flipped } = useCard();
  return usePart("card-body", "div", { flipped }, props, {
    style: { "--card-flipped": flipped ? 1 : 0 } as React.CSSProperties,
  });
}

export interface CardFaceState extends Record<string, unknown> {
  side: "front" | "back";
  /** This face is the one turned towards the viewer. */
  visible: boolean;
}
export interface CardFaceProps extends PartProps<"div", CardFaceState> {}

function useFace(side: "front" | "back", props: CardFaceProps) {
  const { flipped } = useCard();
  const visible = side === "back" ? flipped : !flipped;
  // The face turned away is out of the accessibility tree and out of the tab order.
  return usePart(`card-${side}`, "div", { side, visible }, props, {
    "aria-hidden": visible ? undefined : true,
    inert: !visible,
  });
}

/** The front face. `data-visible` is set while it faces the viewer. Renders a `<div>`. */
export function CardFront(props: CardFaceProps): React.ReactElement {
  return useFace("front", props);
}

/** The back face. `data-visible` is set while it faces the viewer. Renders a `<div>`. */
export function CardBack(props: CardFaceProps): React.ReactElement {
  return useFace("back", props);
}
