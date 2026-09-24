/* Shader backgrounds: live GLSL behind the card, over the poster Card.Background shows. Opt-in,
 * like ./frost, so an app that doesn't use them ships no WebGL. */
export { Shader, type ShaderProps, type ShaderState } from "./shader";
export { ShaderLibrary, useShaderLibrary, type ShaderLibraryProps } from "./library";
export {
  defineShader,
  uniformName,
  type ShaderDefinition,
  type ShaderDialect,
  type ShaderParamSpec,
} from "./define";
export { composeFragment, ShaderSourceError } from "./compose";
export { resolveParams, type ResolvedUniform } from "./params";
export { playState, freezeRate, type ShaderPlay, type PlayState } from "./policy";
export { SHADER_PRESETS, loadShaderPreset } from "./presets";
export {
  shaderBackground,
  BUILT_IN_SHADERS,
  type BuiltInShader,
  type ShaderBackground,
  type ShaderParamsById,
  type ShaderParamValue,
} from "../background/background";
