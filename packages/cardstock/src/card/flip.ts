/* The flip, frame by frame, as pure functions: from how far the turn has come (0 front, 1 back,
 * linear in time) and where it was started from, the angle, the lift and the light that every
 * style of flip is drawn with. `Card.Body` writes them as CSS variables each frame. */
import { cubicBezier } from "../utils/progress";

/** A way of turning the card over, combinable with the others:
 * - `sheen`: a band of light glides across the face as it turns, and the face darkens as it tilts
 *   away, both from the live angle;
 * - `lift`: the card rises before it turns and lands after it;
 * - `toward`: where the flip was pressed decides the axis and the direction, so the edge you
 *   press rises toward you (a press near the top or bottom turns it over top to bottom). */
export type CardFlipStyle = "sheen" | "lift" | "toward";

/** Which way the next flip turns: around the vertical axis (`y`) or the horizontal one (`x`),
 * and in which direction. */
export interface CardFlipOrigin {
  axis: "x" | "y";
  direction: 1 | -1;
}

export const DEFAULT_ORIGIN: CardFlipOrigin = { axis: "y", direction: 1 };

/** The origin for a press at `x`, `y` across the element (0..1 each): the top or bottom third
 * turns it over top to bottom, and elsewhere the pressed side rises toward you. */
export function flipOriginAt(x: number, y: number): CardFlipOrigin {
  const nx = x * 2 - 1;
  const ny = y * 2 - 1;
  if (ny < -1 / 3) return { axis: "x", direction: -1 };
  if (ny > 1 / 3) return { axis: "x", direction: 1 };
  return { axis: "y", direction: nx >= 0 ? -1 : 1 };
}

export interface FlipFrame {
  /** Signed degrees around the origin's axis. */
  angle: number;
  /** 0..1: how high the card is lifted (0 without `lift` or `toward`). */
  lift: number;
  /** 0..1: how edge-on the face is, |sin θ|; the sheen and the shade follow it. */
  light: number;
  /** 0..100: where the band of light is across the face, as a `background-position` percentage. */
  sheen: number;
}

const TURN = cubicBezier([0.4, 0, 0.2, 1]);
const HELD_TURN = cubicBezier([0.45, 0, 0.2, 1]);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The turn holds still at both ends while the card rises and lands. */
const held = (t: number, from: number, to: number) => HELD_TURN(clamp01((t - from) / (to - from)));

/** Height of the lift, in px, for the styles in play. */
export const liftHeight = (styles: readonly CardFlipStyle[]): number =>
  styles.includes("lift") ? 60 : styles.includes("toward") ? 36 : 0;

export function flipFrame(t: number, styles: readonly CardFlipStyle[], origin: CardFlipOrigin): FlipFrame {
  const lifted = liftHeight(styles) > 0;
  const turn = styles.includes("lift")
    ? held(t, 0.15, 0.85)
    : styles.includes("toward")
      ? held(t, 0.08, 0.92)
      : TURN(clamp01(t));
  const angle = origin.direction * 180 * turn;
  const light = Math.abs(Math.sin((angle * Math.PI) / 180));
  // The band crosses from −25% to 125% of the face as it turns; as a background position on a
  // gradient 2.5× the face's width, that runs from 100% to 0%.
  const center = -0.25 + 1.5 * turn;
  return {
    angle,
    lift: lifted ? easeInOut(t < 0.5 ? t * 2 : 2 - t * 2) : 0,
    light,
    sheen: ((1.25 - center) / 1.5) * 100,
  };
}

/** The CSS variables of a frame, as `Card.Body` writes them. */
export function flipVars(t: number, frame: FlipFrame, origin: CardFlipOrigin): Record<string, string> {
  return {
    "--card-flip": String(t),
    "--card-flip-angle": String(frame.angle),
    "--card-flip-axis-x": origin.axis === "x" ? "1" : "0",
    "--card-flip-direction": String(origin.direction),
    "--card-flip-lift": String(frame.lift),
    "--card-flip-light": String(frame.light),
    // The band shows a little before the face is edge-on and lingers after.
    "--card-flip-glow": String(frame.light ** 0.6),
    "--card-flip-sheen": `${frame.sheen}%`,
  };
}
