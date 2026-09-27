/* What a shader is: its GLSL, the dialect that GLSL is written in, the parameters a caller can set
 * and the live inputs it reads. Plain data with no WebGL, so definitions can be imported anywhere
 * and only compiled once a surface draws them. */

/** How a shader reads: text over it takes the opposite, light text on `dark`. */
export type Tone = "dark" | "light";

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
  /** What it's known by: `"silk"`, or namespaced for your own, `"acme/tide"`. */
  id: string;
  label: string;
  description?: string;
  source: string;
  /** `"glsl"` by default. */
  dialect?: ShaderDialect;
  /** Each becomes a uniform named `u` + its name capitalised: `turbulence` is `uTurbulence`, a
   * float; a `color` is a `vec3` (sRGB, 0..1); `colors` is a `vec3[max]` plus `int uColorsCount`. */
  params?: P;
  /** Live values the surface reads every frame without re-rendering (a card's flip, a voice's
   * level). Each is a `float` uniform named like a parameter: `level` is `uLevel`. */
  inputs?: readonly string[];
  /** The moment, in seconds, of its still frame: the poster, the first frame, and what reduced
   * motion shows. 0 by default. */
  still?: number;
  /** Render at this fraction of the surface's pixels (upscaled), for heavy shaders; 1 by default. */
  scale?: number;
  /** A frame-rate cap; 60 by default. */
  fps?: number;
  /** How it reads. */
  tone?: Tone;
  /** Who made it, and under what licence. */
  credit?: string;
  license?: string;
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}(?:\/[a-z0-9][a-z0-9-]{0,63})?$/;
const NAME = /^[a-zA-Z]\w{0,31}$/;

/** Declares a shader. Checks the id, parameter and input names, and returns the definition as
 * given. */
export function defineShader<const P extends Readonly<Record<string, ShaderParamSpec>>>(
  definition: ShaderDefinition<P>,
): ShaderDefinition<P> {
  if (!ID.test(definition.id))
    throw new Error(
      `@danolekh/gl: "${definition.id}" isn't a shader id: lowercase, digits and dashes, optionally "namespace/name".`,
    );
  const params = Object.keys(definition.params ?? {});
  for (const name of params)
    if (!NAME.test(name))
      throw new Error(`@danolekh/gl: "${name}" isn't a parameter name for shader "${definition.id}".`);
  for (const name of definition.inputs ?? []) {
    if (!NAME.test(name))
      throw new Error(`@danolekh/gl: "${name}" isn't an input name for shader "${definition.id}".`);
    if (params.includes(name))
      throw new Error(`@danolekh/gl: "${name}" is both a parameter and an input of "${definition.id}".`);
  }
  return definition;
}

/** A parameter's or input's uniform: `u` and its name capitalised. */
export const uniformName = (name: string): string => `u${name[0]!.toUpperCase()}${name.slice(1)}`;
