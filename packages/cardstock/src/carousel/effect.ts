/* The built-in look, as styles written from the carousel's CSS variables: the slides stack in one
 * grid cell and each moves by its offset. The turn of a neighbour is drawn in 2D, narrower and
 * slanted, rather than with `rotateY` under `perspective`: a layer turned in 3D is drawn from a
 * texture at a scale the browser has to guess, and some renderers smear fine artwork on it. */
import type * as React from "react";

export type CarouselEffect = "coverflow" | "none";

export interface EffectOptions {
  gap: number;
  turn: number;
  depth: number;
  fade: number;
  direction: 1 | -1;
}

/** The tuning, as variables on the root; every slide reads them. */
export function effectVars({ gap, turn, depth, fade, direction }: EffectOptions): React.CSSProperties {
  return {
    "--carousel-gap": `${gap}px`,
    "--carousel-turn": turn,
    "--carousel-depth": depth,
    "--carousel-fade": fade,
    "--carousel-direction": direction,
  } as React.CSSProperties;
}

/** The track is a stacking context of its own (`isolation: isolate`), so the slides' z-indexes,
 * which put the middle card on top, only order the slides: without it they'd rise over the page's
 * own menus, popovers and drawers too. */
export const coverflowTrack = (dragging: boolean): React.CSSProperties => ({
  display: "grid",
  isolation: "isolate",
  cursor: dragging ? "grabbing" : "grab",
});

export const COVERFLOW_SLIDE: React.CSSProperties = {
  gridArea: "1 / 1",
  willChange: "transform",
  userSelect: "none",
  transform: [
    // A card further back also sits nearer the middle, as it would in perspective.
    "translateX(calc(var(--slide-offset) * var(--carousel-direction) * (100% + var(--carousel-gap)) * (1 - var(--slide-distance) * var(--carousel-depth) * 0.5)))",
    "scale(calc(1 - var(--slide-distance) * var(--carousel-depth)))",
    // Turned away: narrower, and slanted so its outer edge reads nearer.
    "scaleX(calc(1 - var(--slide-distance) * var(--carousel-turn) * 0.09))",
    "skewY(calc(var(--slide-offset-clamped) * var(--carousel-direction) * var(--carousel-turn) * -3deg))",
  ].join(" "),
  opacity: "calc(1 - var(--slide-distance) * var(--carousel-fade))",
};

/** The variables written every frame. Registered as numbers that don't inherit: an inherited one
 * changing restyles every element under it, and with a few cards on the track that's hundreds
 * of elements a frame, enough to drop frames on a slower machine. The slides read their own, and
 * anything deeper that wants one takes it with `--slide-distance: inherit`. */
export const MOVING_PROPERTIES = [
  "--carousel-position",
  "--slide-offset",
  "--slide-offset-clamped",
  "--slide-distance",
] as const;

let registered = false;

/** Registers `MOVING_PROPERTIES` once per page, where the browser can. */
export function registerCarouselProperties(): void {
  if (registered) return;
  registered = true;
  if (typeof CSS === "undefined" || !("registerProperty" in CSS)) return;
  for (const name of MOVING_PROPERTIES) {
    try {
      CSS.registerProperty({ name, syntax: "<number>", inherits: false, initialValue: "0" });
    } catch {
      // Already registered: another copy of cardstock on the page, a hot reload, or your own
      // `@property`. Whichever came first stands.
    }
  }
}

const written = new WeakMap<HTMLElement, { z: string; visibility: string }>();

/** Per frame, for one slide: the variables every look reads, and with the coverflow the stacking
 * (nearest on top) and slides far off hidden, written only when they change. */
export function writeSlide(el: HTMLElement, offset: number, effect: CarouselEffect): void {
  const distance = Math.min(1, Math.abs(offset));
  el.style.setProperty("--slide-offset", String(offset));
  el.style.setProperty("--slide-offset-clamped", String(Math.max(-1, Math.min(1, offset))));
  el.style.setProperty("--slide-distance", String(distance));
  if (effect !== "coverflow") return;
  const z = String(100 - Math.round(Math.abs(offset) * 10));
  const visibility = Math.abs(offset) > 2 ? "hidden" : "";
  const last = written.get(el);
  if (last?.z !== z) el.style.zIndex = z;
  if (last?.visibility !== visibility) el.style.visibility = visibility;
  written.set(el, { z, visibility });
}

export const slideVars = (offset: number): React.CSSProperties =>
  ({
    "--slide-offset": offset,
    "--slide-offset-clamped": Math.max(-1, Math.min(1, offset)),
    "--slide-distance": Math.min(1, Math.abs(offset)),
  }) as React.CSSProperties;
