"use client";
import type * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { backgroundStyle, backgroundTone, type CardBackground, type Tone } from "../background/background";
import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";

export interface CardBackgroundState extends Record<string, unknown> {
  type: CardBackground["type"] | undefined;
  tone: Tone | undefined;
  /** An image background has loaded (always false for the others). */
  loaded: boolean;
  /** An image background failed to load; its `color` shows instead. */
  error: boolean;
}

export interface CardBackgroundProps extends PartProps<"div", CardBackgroundState> {
  /** Paint this instead of the card's `background`, e.g. a plainer back face. */
  value?: CardBackground;
  /** For an image: `"lazy"` defers it until the card nears the viewport. */
  loading?: "eager" | "lazy";
  /** For an image with `srcSet`: the width the card is shown at. */
  sizes?: string;
}

const FILL: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

/** Paints the card's `background` (or `value`): a colour or gradient on itself, an image as an
 * <img> inside it, over its colour until it loads. Size it to the face yourself, e.g.
 * `absolute inset-0` as the face's first child. Renders a `<div>`. */
export function CardBackgroundPart(props: CardBackgroundProps): React.ReactElement {
  const { value, loading, sizes = "(min-width: 480px) 480px, 100vw", children, ...rest } = props;
  const card = useCard();
  const bg = value ?? card.background;
  const src = bg?.type === "image" ? bg.src : undefined;
  const [settled, setSettled] = useState<{ src: string; ok: boolean } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image already in the cache (or loaded before hydration) fires no load event for React.
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (src && img?.complete && img.naturalWidth) setSettled({ src, ok: true });
  }, [src]);

  const outcome = settled && settled.src === src ? settled.ok : undefined;
  const state: CardBackgroundState = {
    type: bg?.type,
    tone: bg ? backgroundTone(bg) : undefined,
    loaded: outcome === true,
    error: outcome === false,
  };
  return usePart("card-background", "div", state, rest, {
    "aria-hidden": true,
    style: bg ? backgroundStyle(bg) : undefined,
    children: (
      <>
        {bg?.type === "image" && (
          <img
            ref={imgRef}
            key={bg.src}
            data-slot="card-background-image"
            alt=""
            src={bg.src}
            srcSet={bg.srcSet}
            sizes={bg.srcSet ? sizes : undefined}
            loading={loading}
            decoding="async"
            draggable={false}
            onLoad={() => setSettled({ src: bg.src, ok: true })}
            onError={() => setSettled({ src: bg.src, ok: false })}
            style={{
              ...FILL,
              objectFit: "cover",
              objectPosition: bg.position,
              visibility: outcome === false ? "hidden" : undefined,
            }}
          />
        )}
        {children}
      </>
    ),
  });
}
