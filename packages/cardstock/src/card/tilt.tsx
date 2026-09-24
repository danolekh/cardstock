"use client";
import type * as React from "react";
import { useRef, useState } from "react";

import { useFinePointer, usePrefersReducedMotion } from "../utils/media";
import { type PartProps, usePart } from "../utils/part";

export interface CardTiltState extends Record<string, unknown> {
  hovering: boolean;
  /** Tilt is off: a coarse pointer, reduced motion, or `disabled`. */
  disabled: boolean;
}
export interface CardTiltProps extends PartProps<"div", CardTiltState> {
  disabled?: boolean;
}

const VARS = (x: number, y: number) => ({
  "--card-pointer-x": x,
  "--card-pointer-y": y,
  "--card-tilt-x": (x - 0.5) * 2,
  "--card-tilt-y": (y - 0.5) * 2,
});

/** Follows the pointer over the card and writes it as CSS variables, without re-rendering:
 * `--card-pointer-x/y` (0..1 across the element) and `--card-tilt-x/y` (-1..1 from the middle).
 * Turn them into a tilt and a glare in CSS; add a short transition to smooth them. Off for touch
 * and reduced motion. Renders a `<div>`. */
export function CardTilt(props: CardTiltProps): React.ReactElement {
  const { disabled: disabledProp = false, ...rest } = props;
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const disabled = disabledProp || !fine || reduced;
  const [hovering, setHovering] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);

  const write = (x: number, y: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      for (const [k, v] of Object.entries(VARS(x, y))) ref.current?.style.setProperty(k, String(v));
    });
  };

  return usePart(
    "card-tilt",
    "div",
    { hovering, disabled },
    rest,
    {
      style: VARS(0.5, 0.5) as React.CSSProperties,
      onPointerEnter: () => !disabled && setHovering(true),
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (disabled) return;
        const r = e.currentTarget.getBoundingClientRect();
        write((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      },
      onPointerLeave: () => {
        setHovering(false);
        write(0.5, 0.5);
      },
    },
    [ref as React.Ref<never>],
  );
}
