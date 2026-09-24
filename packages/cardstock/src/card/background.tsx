"use client";
import type * as React from "react";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";

import { backgroundStyle, backgroundTone, type CardBackground, type Tone } from "../background/background";
import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";

export interface CardBackgroundState extends Record<string, unknown> {
  type: CardBackground["type"] | undefined;
  tone: Tone | undefined;
  /** An image background, or a shader's poster, has loaded (always false for the others). */
  loaded: boolean;
  /** An image background, or a shader's poster, failed to load; its `color` shows instead. */
  error: boolean;
}

export interface CardBackgroundProps extends PartProps<"div", CardBackgroundState> {
  /** Paint this instead of the card's `background`, e.g. a plainer back face. */
  value?: CardBackground;
  /** For an image or a poster: `"lazy"` defers it until the card nears the viewport. */
  loading?: "eager" | "lazy";
  /** For an image or a poster with a `srcSet`: the width the card is shown at. */
  sizes?: string;
}

/** What the nearest `Card.Background` paints (its `value`, else the card's), for the layers inside
 * it such as <Shader />. */
const BackgroundValueContext = createContext<CardBackground | undefined>(undefined);
export const useBackgroundValue = (): CardBackground | undefined => useContext(BackgroundValueContext);

const FILL: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

/** Paints the card's `background` (or `value`): a colour or gradient on itself, an image (or a
 * shader's poster) as an <img> inside it, over its colour until it loads. A shader itself is drawn
 * by <Shader /> from `@danolekh/cardstock/shader`, put inside. Size it to the face yourself, e.g.
 * `absolute inset-0` as the face's first child. Renders a `<div>`. */
export function CardBackgroundPart(props: CardBackgroundProps): React.ReactElement {
  const { value, loading, sizes = "(min-width: 480px) 480px, 100vw", children, ...rest } = props;
  const card = useCard();
  const bg = value ?? card.background;
  const picture =
    bg?.type === "image"
      ? { src: bg.src, srcSet: bg.srcSet, position: bg.position }
      : bg?.type === "shader" && bg.poster
        ? { src: bg.poster, srcSet: bg.posterSrcSet, position: bg.position }
        : undefined;
  const src = picture?.src;
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
        {picture && (
          <img
            ref={imgRef}
            key={picture.src}
            data-slot="card-background-image"
            alt=""
            src={picture.src}
            srcSet={picture.srcSet}
            sizes={picture.srcSet ? sizes : undefined}
            loading={loading}
            decoding="async"
            draggable={false}
            onLoad={() => setSettled({ src: picture.src, ok: true })}
            onError={() => setSettled({ src: picture.src, ok: false })}
            style={{
              ...FILL,
              objectFit: "cover",
              objectPosition: picture.position,
              visibility: outcome === false ? "hidden" : undefined,
            }}
          />
        )}
        <BackgroundValueContext.Provider value={bg}>{children}</BackgroundValueContext.Provider>
      </>
    ),
  });
}
