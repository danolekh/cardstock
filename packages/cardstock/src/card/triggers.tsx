"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";

export interface CardTriggerState extends Record<string, unknown> {
  pressed: boolean;
  disabled: boolean;
}
export interface CardTriggerProps extends PartProps<"button", CardTriggerState> {}

function useToggle(
  slot: string,
  pressed: boolean,
  set: (next: boolean) => void,
  props: CardTriggerProps,
  blocked = false,
) {
  const disabled = blocked || !!props.disabled;
  return usePart(slot, "button", { pressed, disabled }, props as never, {
    type: "button",
    "aria-pressed": pressed,
    disabled,
    onClick: () => set(!pressed),
  });
}

/** Turns the card over. Renders a `<button>` with `aria-pressed`. */
export function CardFlipTrigger(props: CardTriggerProps): React.ReactElement {
  const { flipped, setFlipped } = useCard();
  return useToggle("card-flip-trigger", flipped, setFlipped, props);
}

/** Shows or hides the details. Disabled while the card is frozen. Renders a `<button>`. */
export function CardRevealTrigger(props: CardTriggerProps): React.ReactElement {
  const { revealed, setRevealed, frozen } = useCard();
  return useToggle("card-reveal-trigger", revealed, setRevealed, props, frozen);
}

/** Freezes or unfreezes the card. Renders a `<button>` with `aria-pressed`. */
export function CardFreezeTrigger(props: CardTriggerProps): React.ReactElement {
  const { frozen, setFrozen } = useCard();
  return useToggle("card-freeze-trigger", frozen, setFrozen, props);
}
