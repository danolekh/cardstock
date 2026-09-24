"use client";
import { NumberField } from "@base-ui/react/number-field";
import type * as React from "react";
import { createContext, useContext, useId } from "react";

import { type PartProps, usePart } from "../utils/part";

/* A spending limit: Base UI's NumberField with money defaults. NumberField does the work (typing,
 * clamping to min/max, arrow keys by `step` and Shift+arrows by `largeStep`, dragging across the
 * scrub area); these parts add the currency format, a label wired to the input, a change callback
 * that is never null, and `data-slot`s like the card's own parts. */

export interface LimitFieldRootProps extends Omit<
  NumberField.Root.Props,
  "value" | "defaultValue" | "onValueChange"
> {
  value?: number;
  defaultValue?: number;
  /** Called with each new limit. An emptied input doesn't report; the last limit stays. */
  onValueChange?: (value: number) => void;
  /** ISO 4217 code, e.g. `"EUR"`. Formats the value as whole units of it; `format` overrides. */
  currency?: string;
  /** Shift+arrow and scrub-with-Shift step. By default five `step`s. */
  largeStep?: number;
}

const IdContext = createContext<string | undefined>(undefined);

/** Holds the limit. Renders a `<div>`. */
export function LimitFieldRoot(props: LimitFieldRootProps): React.ReactElement {
  const { onValueChange, currency, format, step = 1, largeStep, id: idProp, ...rest } = props;
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <IdContext.Provider value={id}>
      <NumberField.Root
        data-slot="limit-field"
        id={id}
        step={step}
        largeStep={largeStep ?? (typeof step === "number" ? step * 5 : undefined)}
        format={format ?? (currency ? { style: "currency", currency, maximumFractionDigits: 0 } : undefined)}
        onValueChange={(value) => value !== null && onValueChange?.(value)}
        {...rest}
      />
    </IdContext.Provider>
  );
}

export interface LimitFieldLabelProps extends PartProps<"label", Record<string, never>> {}

/** Names the input. Renders a `<label>` pointing at it. */
export function LimitFieldLabel(props: LimitFieldLabelProps): React.ReactElement {
  return usePart("limit-field-label", "label", {}, props, { htmlFor: useContext(IdContext) });
}

/** Drag across it to change the limit. Renders a `<span>`. */
export function LimitFieldScrubArea(props: NumberField.ScrubArea.Props): React.ReactElement {
  return <NumberField.ScrubArea data-slot="limit-field-scrub-area" {...props} />;
}

/** The cursor shown while scrubbing (the system one is hidden). Renders a `<span>`. */
export function LimitFieldScrubAreaCursor(
  props: NumberField.ScrubAreaCursor.Props,
): React.ReactElement | null {
  return <NumberField.ScrubAreaCursor data-slot="limit-field-scrub-area-cursor" {...props} />;
}

/** Groups the input and its buttons. Renders a `<div>`. */
export function LimitFieldGroup(props: NumberField.Group.Props): React.ReactElement {
  return <NumberField.Group data-slot="limit-field-group" {...props} />;
}

/** The typeable, formatted value. Renders an `<input>`. */
export function LimitFieldInput(props: NumberField.Input.Props): React.ReactElement {
  return <NumberField.Input data-slot="limit-field-input" {...props} />;
}

/** Raises the limit by `step`. Renders a `<button>`. */
export function LimitFieldIncrement(props: NumberField.Increment.Props): React.ReactElement {
  return <NumberField.Increment data-slot="limit-field-increment" {...props} />;
}

/** Lowers the limit by `step`. Renders a `<button>`. */
export function LimitFieldDecrement(props: NumberField.Decrement.Props): React.ReactElement {
  return <NumberField.Decrement data-slot="limit-field-decrement" {...props} />;
}
