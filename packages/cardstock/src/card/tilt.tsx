"use client";
import type * as React from "react";
import { createContext, useContext, useRef, useState } from "react";

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

export interface CardTiltSurfaceProps extends PartProps<"div", CardTiltState> {
  /** How far the surface turns at the card's edge, in degrees: `x` around the vertical axis (the
   * pointer moving sideways), `y` around the horizontal one. */
  maxTilt?: { x?: number; y?: number };
  /** Depth of the 3D the card turns in, in px: smaller is more dramatic. */
  perspective?: number;
}

const TiltContext = createContext<CardTiltState>({ hovering: false, disabled: true });
const SurfaceContext = createContext(false);

/** Rendered inside `Card.TiltSurface`, which gives the card its perspective. */
export const useInsideTiltSurface = (): boolean => useContext(SurfaceContext);

const VARS = (x: number, y: number) => ({
  "--card-pointer-x": x,
  "--card-pointer-y": y,
  "--card-tilt-x": (x - 0.5) * 2,
  "--card-tilt-y": (y - 0.5) * 2,
});

// Read through a typeof check: in a bundle it's replaced, in a browser without one it isn't defined.
declare const process: { env: { NODE_ENV?: string } } | undefined;
const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
let warned = false;

/** The tilt's hit area: follows the pointer over the card and writes it as CSS variables, without
 * re-rendering: `--card-pointer-x/y` (0..1 across the element) and `--card-tilt-x/y` (-1..1 from
 * the middle). It never moves itself: put `Card.TiltSurface` inside it for the part that turns.
 * Were the hit area to turn, its corner would swing out from under the pointer, the pointer would
 * leave, the card would swing back under it and the pointer would enter again, over and over.
 * Off for touch and reduced motion. Renders a `<div>`. */
export function CardTilt(props: CardTiltProps): React.ReactElement {
  const { disabled: disabledProp = false, children, ...rest } = props;
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const disabled = disabledProp || !fine || reduced;
  const [hovering, setHovering] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const state: CardTiltState = { hovering, disabled };

  const write = (x: number, y: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      for (const [k, v] of Object.entries(VARS(x, y))) ref.current?.style.setProperty(k, String(v));
    });
  };

  return usePart(
    "card-tilt",
    "div",
    state,
    rest,
    {
      style: VARS(0.5, 0.5) as React.CSSProperties,
      children: <TiltContext.Provider value={state}>{children}</TiltContext.Provider>,
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
        if (disabled) return;
        setHovering(true);
        if (DEV && !warned) {
          const transform = getComputedStyle(e.currentTarget).transform;
          if (transform && transform !== "none") {
            warned = true;
            console.warn(
              "cardstock: Card.Tilt has a transform of its own. Turn Card.TiltSurface instead, or the card flickers when the pointer is near its edge.",
            );
          }
        }
      },
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

/** The part of the card that turns with the tilt: put it inside `Card.Tilt`, around the body. It
 * turns by `--card-tilt-x/y` with a short ease; restyle `transform` and `transition` to change
 * that. Renders a `<div>`. */
export function CardTiltSurface(props: CardTiltSurfaceProps): React.ReactElement {
  const { maxTilt, perspective = 1100, ...rest } = props;
  const state = useContext(TiltContext);
  const x = maxTilt?.x ?? 12;
  const y = maxTilt?.y ?? 10;
  const { children, ...parts } = rest;
  return usePart("card-tilt-surface", "div", state, parts, {
    style: {
      // The perspective is part of the surface's own transform, so it reaches the card wherever
      // the surface sits inside the hit area, and everything within turns in it.
      transform: `perspective(${perspective}px) rotateX(calc(var(--card-tilt-y) * ${-y}deg)) rotateY(calc(var(--card-tilt-x) * ${x}deg))`,
      transition: "transform 150ms ease-out",
      transformStyle: "preserve-3d",
    },
    children: <SurfaceContext.Provider value={true}>{children}</SurfaceContext.Provider>,
  });
}
