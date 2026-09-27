/** `play`: time runs. `hold`: keep the frame it shows (drawing one if it has none). `still`: show
 * the still frame, for reduced motion. */
export type PlayState = "play" | "hold" | "still";

/** The shader's clock after `dt` seconds. */
export const advance = (time: number, dt: number, speed: number): number => time + dt * speed;
