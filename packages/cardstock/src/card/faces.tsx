"use client";
import type * as React from "react";
import { createContext, useContext, useMemo, useRef, useState } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useIsoLayoutEffect } from "../utils/use-iso-layout-effect";
import { useCard } from "./context";
import { type CardFlipStyle, DEFAULT_ORIGIN, flipFrame, flipVars, liftHeight } from "./flip";
import { useInsideTiltSurface } from "./tilt";

export type CardFlipEffect = CardFlipStyle | readonly CardFlipStyle[] | "none";

export interface CardBodyState extends Record<string, unknown> {
  flipped: boolean;
}
export interface CardBodyProps extends PartProps<"div", CardBodyState> {
  /** How it turns over: `"sheen"` (the default), `"lift"`, `"toward"`, several of them (e.g.
   * `["lift", "sheen"]`), or `"none"` to turn it yourself with the CSS variables. */
  effect?: CardFlipEffect;
}

const styleList = (effect: CardFlipEffect): readonly CardFlipStyle[] =>
  effect === "none" ? [] : typeof effect === "string" ? [effect] : effect;

/** What the faces need from the body: which styles are in play, and whether it turns at all. */
const BodyContext = createContext<{ styles: readonly CardFlipStyle[]; turning: boolean }>({
  styles: [],
  turning: false,
});

/** The element that turns over. Every frame of the flip it writes, on itself:
 * - `--card-flip`: 0 (front) to 1 (back), linear in time;
 * - `--card-flip-angle`: the turn in degrees, signed, eased by the style;
 * - `--card-flip-axis-x`: 1 when it turns top to bottom, 0 side to side;
 * - `--card-flip-direction`: 1 or −1;
 * - `--card-flip-lift`: 0..1, how high it's lifted;
 * - `--card-flip-light`: 0..1, how edge-on the face is (`--card-flip-glow`, the same eased);
 * - `--card-flip-sheen`: where the band of light is, as a background position;
 * plus `--card-flipped` (0 or 1) and `data-flipped`. With an `effect` it turns itself by them;
 * with `effect="none"` the turn is yours. Renders a `<div>`. */
export function CardBody(props: CardBodyProps): React.ReactElement {
  const { effect = "sheen", children, ...rest } = props;
  const { flipped, flip, flipOrigin, reducedMotion } = useCard();
  const insideTilt = useInsideTiltSurface();
  const styles = styleList(effect);
  const key = styles.join();
  const ref = useRef<HTMLElement>(null);

  // The moving variables are written every frame; React only sees the first ones, so a
  // re-render can't snap the card to either face mid-turn.
  const [initialVars] = useState(() => {
    const t = flip.get();
    return flipVars(t, flipFrame(t, styles, DEFAULT_ORIGIN), DEFAULT_ORIGIN) as React.CSSProperties;
  });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const list = key ? (key.split(",") as CardFlipStyle[]) : [];
    const write = (t: number) => {
      const origin = list.includes("toward") ? flipOrigin.get() : DEFAULT_ORIGIN;
      for (const [k, v] of Object.entries(flipVars(t, flipFrame(t, list, origin), origin)))
        el.style.setProperty(k, v);
    };
    write(flip.get());
    return flip.subscribe(write);
  }, [flip, flipOrigin, key]);

  // Reduced motion: nothing turns, the faces cross-fade (see the faces).
  const turning = styles.length > 0 && !reducedMotion;
  const lift = liftHeight(styles);
  const own: React.CSSProperties = turning
    ? {
        transformStyle: "preserve-3d",
        transform: [
          // Outside a tilt surface, which lends its perspective, the body brings its own.
          insideTilt ? "" : "perspective(1100px)",
          lift ? `translateZ(calc(var(--card-flip-lift) * ${lift}px))` : "",
          "rotateX(calc(var(--card-flip-angle) * var(--card-flip-axis-x) * 1deg))",
          "rotateY(calc(var(--card-flip-angle) * (1 - var(--card-flip-axis-x)) * 1deg))",
        ]
          .filter(Boolean)
          .join(" "),
      }
    : {};

  return usePart(
    "card-body",
    "div",
    { flipped },
    rest,
    {
      style: { "--card-flipped": flipped ? 1 : 0, ...initialVars, ...own } as React.CSSProperties,
      children: <BodyContext.Provider value={{ styles, turning }}>{children}</BodyContext.Provider>,
    },
    [ref as React.Ref<never>],
  );
}

export interface CardFaceState extends Record<string, unknown> {
  side: "front" | "back";
  /** This face is the one turned towards the viewer. */
  visible: boolean;
}
export interface CardFaceProps extends PartProps<"div", CardFaceState> {}

const FX: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  borderRadius: "inherit",
};

/** The light of the `sheen` style: a shade that deepens as the face turns away, and a band of
 * light gliding across it. Left out of the frost's snapshot. */
function Sheen() {
  return (
    <>
      <span
        aria-hidden
        data-slot="card-sheen-shade"
        data-frost-skip=""
        style={{ ...FX, background: "#000", opacity: "calc(var(--card-flip-light) * 0.55)" }}
      />
      <span
        aria-hidden
        data-slot="card-sheen"
        data-frost-skip=""
        style={{
          ...FX,
          background:
            "linear-gradient(100deg, transparent 38%, rgb(255 255 255 / 0.95) 50%, transparent 62%)",
          backgroundSize: "250% 100%",
          backgroundPosition: "var(--card-flip-sheen) 0",
          mixBlendMode: "soft-light",
          opacity: "var(--card-flip-glow)",
        }}
      />
      {/* A narrower plain band over it, so the light shows on dark cards too. */}
      <span
        aria-hidden
        data-slot="card-sheen"
        data-frost-skip=""
        style={{
          ...FX,
          background:
            "linear-gradient(100deg, transparent 44%, rgb(255 255 255 / 0.42) 50%, transparent 56%)",
          backgroundSize: "250% 100%",
          backgroundPosition: "var(--card-flip-sheen) 0",
          opacity: "var(--card-flip-glow)",
        }}
      />
    </>
  );
}

/** The face a part is rendered on, and whether it faces the viewer; null outside the faces. */
const FaceContext = createContext<{ side: "front" | "back"; visible: boolean } | null>(null);
export const useFaceSide = (): { side: "front" | "back"; visible: boolean } | null => useContext(FaceContext);

function useFace(side: "front" | "back", props: CardFaceProps) {
  const { flipped, reducedMotion } = useCard();
  const { styles, turning } = useContext(BodyContext);
  const { children, ...rest } = props;
  const visible = side === "back" ? flipped : !flipped;
  const face = useMemo(() => ({ side, visible }), [side, visible]);
  const own: React.CSSProperties = turning
    ? {
        backfaceVisibility: "hidden",
        // The back waits turned the way the body will turn to it.
        ...(side === "back"
          ? {
              transform:
                "rotateX(calc(var(--card-flip-axis-x) * 180deg)) rotateY(calc((1 - var(--card-flip-axis-x)) * 180deg))",
            }
          : {}),
      }
    : styles.length > 0 && reducedMotion
      ? { opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }
      : {};
  // The face turned away is out of the accessibility tree and out of the tab order.
  return usePart(`card-${side}`, "div", { side, visible }, rest, {
    "aria-hidden": visible ? undefined : true,
    inert: !visible,
    style: own,
    children: (
      <FaceContext.Provider value={face}>
        {children}
        {turning && styles.includes("sheen") ? <Sheen /> : null}
      </FaceContext.Provider>
    ),
  });
}

/** The front face. `data-visible` is set while it faces the viewer. Renders a `<div>`. */
export function CardFront(props: CardFaceProps): React.ReactElement {
  return useFace("front", props);
}

/** The back face. `data-visible` is set while it faces the viewer. Renders a `<div>`. */
export function CardBack(props: CardFaceProps): React.ReactElement {
  return useFace("back", props);
}
