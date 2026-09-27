/* When a shader moves. Pure, so the rules can be tested without a GPU. */

import type { PlayState } from "@danolekh/gl";

export { advance, type PlayState } from "@danolekh/gl";

export type ShaderPlay = "auto" | "always" | "paused";

export interface PlayInputs {
  play: ShaderPlay;
  reducedMotion: boolean;
  /** Whether its carousel slide is the current one; undefined outside a carousel. */
  slideActive: boolean | undefined;
  /** Whether its face faces the viewer; undefined outside the faces. */
  faceVisible: boolean | undefined;
  /** The card is mid-flip, so both faces are in view. */
  turning: boolean;
}

/** What the part asks for. The scheduler adds what it knows: off-screen or in a hidden tab, time
 * stops whatever this says. */
export function playState(i: PlayInputs): PlayState {
  if (i.reducedMotion) return "still";
  if (i.play === "paused") return "hold";
  if (i.play === "always") return "play";
  if (i.slideActive === false) return "hold";
  if (i.faceVisible === false && !i.turning) return "hold";
  return "play";
}
