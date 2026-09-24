"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useRevealScope } from "./context";
import { maskText } from "./mask";

export interface CardFieldState extends Record<string, unknown> {
  revealed: boolean;
}
export interface CardFieldProps extends PartProps<"span", CardFieldState> {
  /** Mask the digits of the text children until the details are revealed. */
  maskWhenHidden?: boolean;
  /** Follow this `Card.RevealGroup` instead of the one around it, or the whole card. */
  group?: string;
}

function useField(slot: string, { maskWhenHidden, children, group, ...props }: CardFieldProps) {
  const scope = useRevealScope(group);
  const { revealed } = scope;
  const text =
    maskWhenHidden && !revealed && typeof children === "string"
      ? maskText(children, { visible: 0 })
      : children;
  return usePart(slot, "span", { revealed }, props, {
    "data-reveal-group": scope.group,
    children: text,
  });
}

/** The cardholder's name. Renders a `<span>`. */
export function CardHolder(props: CardFieldProps): React.ReactElement {
  return useField("card-holder", props);
}

/** The expiry date. Renders a `<span>`. */
export function CardExpiry(props: CardFieldProps): React.ReactElement {
  return useField("card-expiry", props);
}
