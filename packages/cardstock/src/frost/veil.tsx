"use client";
import type * as React from "react";
import { useEffect, useRef } from "react";

import { useCard } from "../card/context";

/** The frosted gradient both frosts show: `<FrostVeil />` always, `<Frost />` until its shader
 * draws and wherever WebGL2 isn't there. */
export const FROST_VEIL =
  "linear-gradient(120deg, rgba(222,238,255,0.72), rgba(236,245,255,0.55) 45%, rgba(248,251,255,0.75))";

export const FILL: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/** Keeps an element's opacity on the card's freeze progress (0 thawed, 1 frozen), or at 0 while
 * `enabled` is false, without re-rendering. */
export function useFreezeOpacity(enabled = true): React.RefObject<HTMLDivElement | null> {
  const { freeze } = useCard();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (p: number) => (el.style.opacity = String(enabled ? p : 0));
    apply(freeze.get());
    return freeze.subscribe(apply);
  }, [freeze, enabled]);
  return ref;
}

export interface FrostVeilProps {
  /** The gradient (any CSS `background`). */
  background?: string;
  /** Blur of what's underneath, in px. */
  blur?: number;
  className?: string;
}

/** Frost without WebGL: a frosted gradient over a slight blur, fading in as the card freezes. It
 * holds no canvas and no GPU context, so use it for cards that aren't in focus (browsers cap live
 * WebGL contexts) and anywhere the shader isn't wanted. Put it inside `Card.Front` or `Card.Back`,
 * after the content it covers. Renders a `<div>`. */
export function FrostVeil(props: FrostVeilProps): React.ReactElement {
  const { background = FROST_VEIL, blur = 2, className } = props;
  const ref = useFreezeOpacity();
  return (
    <div
      ref={ref}
      data-slot="card-frost-veil"
      data-frost-skip=""
      aria-hidden
      className={className}
      style={{ ...FILL, background, backdropFilter: `blur(${blur}px)`, opacity: 0 }}
    />
  );
}
