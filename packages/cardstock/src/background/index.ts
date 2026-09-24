/* The background format on its own, with no React and no client code: for validating stored
 * backgrounds on a server, in a build script, or in cardstock-backgrounds. */
export {
  parseCardBackground,
  parseRgb,
  backgroundTone,
  backgroundInk,
  backgroundStyle,
  frostBase,
  shaderBackground,
  BUILT_IN_SHADERS,
  type BuiltInShader,
  type ShaderParamsById,
  type ShaderParamValue,
  type ShaderBackground,
  type CardBackground,
  type SolidBackground,
  type LinearBackground,
  type RadialBackground,
  type ImageBackground,
  type ColorStop,
  type Tone,
  type FrostBase,
} from "./background";
