"use client";
import type * as React from "react";
import { createContext, useContext } from "react";

import { type PartProps, usePart } from "../utils/part";

export interface CardSpendingState extends Record<string, unknown> {
  overLimit: boolean;
}
export interface CardSpendingProps extends PartProps<"div", CardSpendingState> {
  /** Spent so far. */
  value: number;
  /** The limit. */
  max: number;
  /** Read out with the value, e.g. `(v) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v)`. */
  format?: (value: number) => string;
}

const RatioContext = createContext<CardSpendingState>({ overLimit: false });

/** Spending against a limit: `role="meter"` with `--card-spending-ratio` (0..1). Needs no
 * `Card.Root`, so it also works beside the card. Renders a `<div>`. */
export function CardSpending(props: CardSpendingProps): React.ReactElement {
  const { value, max, format = String, ...rest } = props;
  const ratio = Math.min(1, Math.max(0, value / Math.max(1, max)));
  const state: CardSpendingState = { overLimit: value > max };
  const element = usePart("card-spending", "div", state, rest, {
    role: "meter",
    // A meter needs a name; yours (aria-label or aria-labelledby) replaces this one.
    "aria-label": rest["aria-labelledby"] ? undefined : "Spending against the limit",
    "aria-valuemin": 0,
    "aria-valuemax": max,
    "aria-valuenow": value,
    "aria-valuetext": `${format(value)} of ${format(max)}`,
    style: { "--card-spending-ratio": ratio } as React.CSSProperties,
  });
  return <RatioContext.Provider value={state}>{element}</RatioContext.Provider>;
}

export interface CardSpendingIndicatorProps extends PartProps<"div", CardSpendingState> {}

/** The filled part of the meter; scale it with `transform: scaleX(var(--card-spending-ratio))`.
 * Renders a `<div>`. */
export function CardSpendingIndicator(props: CardSpendingIndicatorProps): React.ReactElement {
  return usePart("card-spending-indicator", "div", useContext(RatioContext), props, {});
}
