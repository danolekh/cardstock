/* The background format on its own, with no React and no client code: for validating stored
 * backgrounds on a server, in a build script, or in cardstock-backgrounds. */
export {
  parseCardBackground,
  parseRgb,
  backgroundTone,
  backgroundInk,
  backgroundStyle,
  frostBase,
  type CardBackground,
  type SolidBackground,
  type LinearBackground,
  type RadialBackground,
  type ImageBackground,
  type ColorStop,
  type Tone,
  type FrostBase,
} from "./background";
