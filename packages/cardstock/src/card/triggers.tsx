"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCard, useRevealScope } from "./context";

export interface CardTriggerState extends Record<string, unknown> {
  pressed: boolean;
  disabled: boolean;
}
export interface CardTriggerProps extends PartProps<"button", CardTriggerState> {}
export interface CardRevealTriggerProps extends CardTriggerProps {
  /** Show and hide this `Card.RevealGroup` instead of the one around it, or the whole card. */
  group?: string;
}

function useToggle(
  slot: string,
  pressed: boolean,
  set: (next: boolean) => void,
  props: CardTriggerProps,
  blocked = false,
  own: Record<string, unknown> = {},
) {
  const disabled = blocked || !!props.disabled;
  return usePart(slot, "button", { pressed, disabled }, props as never, {
    type: "button",
    "aria-pressed": pressed,
    disabled,
    onClick: () => set(!pressed),
    ...own,
  });
}

/** Turns the card over. Renders a `<button>` with `aria-pressed`. */
export function CardFlipTrigger(props: CardTriggerProps): React.ReactElement {
  const { flipped, setFlipped } = useCard();
  return useToggle("card-flip-trigger", flipped, setFlipped, props);
}

/** Shows or hides the details, or one `Card.RevealGroup` of them. Disabled while the card is
 * frozen. Renders a `<button>`. */
export function CardRevealTrigger(props: CardRevealTriggerProps): React.ReactElement {
  const { group, ...rest } = props;
  const { revealed, setRevealed, frozen, group: id } = useRevealScope(group);
  return useToggle("card-reveal-trigger", revealed, setRevealed, rest, frozen, {
    "data-reveal-group": id,
  });
}

/** Freezes or unfreezes the card. Renders a `<button>` with `aria-pressed`. */
export function CardFreezeTrigger(props: CardTriggerProps): React.ReactElement {
  const { frozen, setFrozen } = useCard();
  return useToggle("card-freeze-trigger", frozen, setFrozen, props);
}
