"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCardCarousel } from "./context";

export interface CardCarouselButtonState extends Record<string, unknown> {
  disabled: boolean;
}
export interface CardCarouselButtonProps extends PartProps<"button", CardCarouselButtonState> {}

function useStep(slot: string, step: -1 | 1, props: CardCarouselButtonProps) {
  const { index, count, setIndex, labels } = useCardCarousel();
  // Before the slides are counted (server rendering without `count`), only Previous on the first
  // slide is known to be disabled.
  const disabled = step < 0 ? index <= 0 : count !== undefined && index >= count - 1;
  return usePart(slot, "button", { disabled }, props as never, {
    type: "button",
    "aria-label": step < 0 ? labels.previous : labels.next,
    disabled,
    onClick: () => setIndex(index + step),
  });
}

/** Goes to the previous slide; disabled on the first. Renders a `<button>`. */
export function CardCarouselPrevious(props: CardCarouselButtonProps): React.ReactElement {
  return useStep("carousel-previous", -1, props);
}

/** Goes to the next slide; disabled on the last. Renders a `<button>`. */
export function CardCarouselNext(props: CardCarouselButtonProps): React.ReactElement {
  return useStep("carousel-next", 1, props);
}
