"use client";
import { LimitField as Limit } from "@danolekh/cardstock/limit";
import type * as React from "react";

/* A limit you change by dragging across the number, styled over cardstock's LimitField (Base UI's
 * NumberField with money defaults): the scrub area turns horizontal drags into steps (and hides
 * the cursor while you scrub), and the input stays typeable and keyboard-accessible. */

export interface LimitFieldProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  currency?: string;
  locale?: string;
  label?: string;
  /** Id of the input, which the label points at. */
  id?: string;
}

export function LimitField({
  value,
  onValueChange,
  min = 500,
  max = 5000,
  step = 50,
  currency = "EUR",
  locale = "de-AT",
  label = "Monthly limit",
  id = "limit",
}: LimitFieldProps): React.ReactElement {
  return (
    <Limit.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      locale={locale}
      currency={currency}
      // The id goes to the input; Base UI points its buttons' aria-controls at it.
      id={id}
      className="flex items-center justify-between gap-3"
    >
      <Limit.ScrubArea
        pixelSensitivity={3}
        className="text-muted-foreground cursor-ew-resize text-sm select-none"
        title="Drag sideways to change"
      >
        <Limit.Label className="cursor-ew-resize">
          {label} <span className="text-xs">· drag</span>
        </Limit.Label>
        <Limit.ScrubAreaCursor className="drop-shadow-[0_1px_1px_rgb(0_0_0/0.4)]">
          <ScrubIcon />
        </Limit.ScrubAreaCursor>
      </Limit.ScrubArea>
      <Limit.Group className="border-border flex items-center rounded-lg border">
        <Limit.Decrement className="text-muted-foreground hover:text-foreground px-2.5 py-1">
          −
        </Limit.Decrement>
        <Limit.Input className="border-border focus:bg-accent/40 w-24 border-x bg-transparent py-1 text-center text-sm tabular-nums outline-none" />
        <Limit.Increment className="text-muted-foreground hover:text-foreground px-2.5 py-1">
          +
        </Limit.Increment>
      </Limit.Group>
    </Limit.Root>
  );
}

function ScrubIcon() {
  return (
    <svg width="26" height="14" viewBox="0 0 24 14" fill="currentColor" aria-hidden>
      <path d="M19.5 5.5L6.5 5.5V3.5L0.5 7L6.5 10.5V8.5L19.5 8.5V10.5L25.5 7L19.5 3.5V5.5Z" />
    </svg>
  );
}
