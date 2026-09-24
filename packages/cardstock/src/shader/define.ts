/* What a shader is: its GLSL, the dialect that GLSL is written in, and the parameters a background
 * can set. Plain data with no WebGL, so definitions can be imported anywhere and only compiled
 * once a <Shader /> draws them. */

import type { Tone } from "../background/background";

/** The GLSL's shape:
 * - `"glsl"`: the body of a GLSL ES 3.00 fragment shader with its own `void main()`, writing
 *   `fragColor` from `gl_FragCoord`;
 * - `"shadertoy"`: a `void mainImage(out vec4 fragColor, in vec2 fragCoord)`, with `iTime`,
 *   `iResolution`, `iMouse` and `iFrame` (no `iChannel`s or buffers);
 * - `"twigl"`: the body of main in twigl's "geeker (300 es)" mode: `FC`, `r`, `t`, `m`, `f` in,
 *   `o` out, and its `hsv`, `rotate2D`, `rotate3D` and `snoise2D/3D` helpers. */
export type ShaderDialect = "glsl" | "shadertoy" | "twigl";

export type ShaderParamSpec =
  | { type: "float"; default: number; min: number; max: number; step?: number; label?: string }
  | { type: "color"; default: string; label?: string }
  | { type: "colors"; default: readonly string[]; min?: number; max: number; label?: string };

export interface ShaderDefinition<
  P extends Readonly<Record<string, ShaderParamSpec>> = Readonly<Record<string, ShaderParamSpec>>,
> {
  /** What a background names it by: `"silk"`, or namespaced for your own, `"acme/tide"`. */
  id: string;
  label: string;
  description?: string;
  source: string;
  /** `"glsl"` by default. */
  dialect?: ShaderDialect;
  /** Each becomes a uniform named `u` + its name capitalised: `turbulence` is `uTurbulence`, a
   * float; a `color` is a `vec3` (sRGB, 0..1); `colors` is a `vec3[max]` plus `int uColorsCount`. */
  params?: P;
  /** The moment, in seconds, of its still frame: the poster, the first frame, and what reduced
   * motion shows. 0 by default. */
  still?: number;
  /** Render at this fraction of the card's pixels (upscaled), for heavy shaders; 1 by default. */
  scale?: number;
  /** A frame-rate cap; 60 by default. */
  fps?: number;
  /** How it reads, for when the background data doesn't say. */
  tone?: Tone;
  /** Who made it, and under what licence. */
  credit?: string;
  license?: string;
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}(?:\/[a-z0-9][a-z0-9-]{0,63})?$/;
const PARAM = /^[a-zA-Z]\w{0,31}$/;

/** Declares a shader. Checks the id and parameter names, and returns the definition as given. */
export function defineShader<const P extends Readonly<Record<string, ShaderParamSpec>>>(
  definition: ShaderDefinition<P>,
): ShaderDefinition<P> {
  if (!ID.test(definition.id))
    throw new Error(
      `cardstock: "${definition.id}" isn't a shader id: lowercase, digits and dashes, optionally "namespace/name".`,
    );
  for (const name of Object.keys(definition.params ?? {}))
    if (!PARAM.test(name))
      throw new Error(`cardstock: "${name}" isn't a parameter name for shader "${definition.id}".`);
  return definition;
}

/** A parameter's uniform: `u` and its name capitalised. */
export const uniformName = (param: string): string => `u${param[0]!.toUpperCase()}${param.slice(1)}`;
