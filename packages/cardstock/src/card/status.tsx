"use client";
import type * as React from "react";
import { useState } from "react";

import { type PartProps, usePart } from "../utils/part";
import { usePresence } from "../utils/presence";
import { useCard } from "./context";

/** How the card stands, for display only: cardstock blocks nothing on it (freezing hides and
 * disables the details; a status doesn't). */
export type CardStatus = "active" | "pending" | "locked" | "expired" | "inactive";

export interface CardStatusState extends Record<string, unknown> {
  open: boolean;
  status: CardStatus | undefined;
}
export interface CardStatusProps extends Omit<PartProps<"div", CardStatusState>, "children"> {
  /** Keep it in the DOM while the card is active (then style `[data-open]` yourself). */
  keepMounted?: boolean;
  /** Your text for the status, or a function of it. */
  children?: React.ReactNode | ((status: CardStatus) => React.ReactNode);
}

/** Shown while the card's `status` is anything but `active`: pending, locked, expired or
 * inactive, as `data-status`. The words are yours. It enters and leaves like
 * `Card.FrozenOverlay`, keeping the last status on screen while it leaves. Renders a `<div>`. */
export function CardStatusPart(props: CardStatusProps): React.ReactElement | null {
  const { keepMounted = false, children, ...rest } = props;
  const { status } = useCard();
  const open = status !== undefined && status !== "active";
  // What to show while leaving, when `status` has already gone back to active.
  const [shown, setShown] = useState(open ? status : undefined);
  if (open && shown !== status) setShown(status);
  const current = open ? status : shown;
  const { phase, ref, attributes } = usePresence(open);
  const element = usePart(
    "card-status",
    "div",
    { open, status: current },
    rest,
    {
      ...attributes,
      children: typeof children === "function" ? current && children(current) : children,
    },
    [ref as React.Ref<never>],
  );
  return phase !== "closed" || keepMounted ? element : null;
}
