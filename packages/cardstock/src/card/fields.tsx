"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";
import { maskText } from "./mask";

export interface CardFieldState extends Record<string, unknown> {
  revealed: boolean;
}
export interface CardFieldProps extends PartProps<"span", CardFieldState> {
  /** Mask the digits of the text children until the details are revealed. */
  maskWhenHidden?: boolean;
}

function useField(slot: string, { maskWhenHidden, children, ...props }: CardFieldProps) {
  const { revealed } = useCard();
  const text =
    maskWhenHidden && !revealed && typeof children === "string"
      ? maskText(children, { visible: 0 })
      : children;
  return usePart(slot, "span", { revealed }, props, { children: text });
}

/** The cardholder's name. Renders a `<span>`. */
export function CardHolder(props: CardFieldProps): React.ReactElement {
  return useField("card-holder", props);
}

/** The expiry date. Renders a `<span>`. */
export function CardExpiry(props: CardFieldProps): React.ReactElement {
  return useField("card-expiry", props);
}
