/* Turns a definition into a complete GLSL ES 3.00 fragment shader: the shared uniforms, one per
 * parameter, then the author's code wrapped for its dialect, so a Shadertoy or twigl shader pastes
 * in as written. */

import { type ShaderDefinition, uniformName } from "./define";

/** Every shader gets these. `uPixelRatio` is the pixels drawn per CSS pixel, `uPointer` 0..1 over
 * the card (y down, as the DOM has it), `uTilt` −1..1 from the middle, `uFlip` and `uFreeze` the
 * card's 0..1 progress, `uSeed` 0..1 per card. */
const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform float uTime;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform vec2 uPointer;
uniform vec2 uTilt;
uniform float uFlip;
uniform float uFreeze;
uniform float uSeed;
uniform int uFrame;
out vec4 fragColor;
`;

export const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

// twigl's helpers, rewritten. The simplex noise is Ian McEwan and Stefan Gustavson's (Ashima Arts,
// MIT), as twigl ships it.
const HSV = `vec3 hsv(float h, float s, float v) {
  vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + k.xyz) * 6.0 - k.www);
  return v * mix(vec3(k.x), clamp(p - k.xxx, 0.0, 1.0), s);
}
`;
const ROTATE2D = `mat2 rotate2D(float r) { return mat2(cos(r), sin(r), -sin(r), cos(r)); }
`;
const ROTATE3D = `mat3 rotate3D(float angle, vec3 axis) {
  vec3 a = normalize(axis);
  float s = sin(angle), c = cos(angle), r = 1.0 - c;
  return mat3(
    a.x * a.x * r + c, a.y * a.x * r + a.z * s, a.z * a.x * r - a.y * s,
    a.x * a.y * r - a.z * s, a.y * a.y * r + c, a.z * a.y * r + a.x * s,
    a.x * a.z * r + a.y * s, a.y * a.z * r - a.x * s, a.z * a.z * r + c);
}
`;
const NOISE_COMMON = `vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
`;
const SNOISE2D = `float snoise2D(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;
const SNOISE3D = `float snoise3D(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const uses = (source: string, name: string) => new RegExp(`\\b${name}\\s*\\(`).test(source);

function twiglHelpers(source: string) {
  let out = "";
  if (uses(source, "hsv")) out += HSV;
  if (uses(source, "rotate2D")) out += ROTATE2D;
  if (uses(source, "rotate3D")) out += ROTATE3D;
  const n2 = uses(source, "snoise2D");
  const n3 = uses(source, "snoise3D");
  if (n2 || n3) out += NOISE_COMMON;
  if (n2) out += SNOISE2D;
  if (n3) out += SNOISE3D;
  return out;
}

function paramUniforms(definition: ShaderDefinition) {
  return Object.entries(definition.params ?? {})
    .map(([param, spec]) => {
      const name = uniformName(param);
      if (spec.type === "float") return `uniform float ${name};\n`;
      if (spec.type === "color") return `uniform vec3 ${name};\n`;
      return `uniform vec3 ${name}[${spec.max}];\nuniform int ${name}Count;\n`;
    })
    .join("");
}

/** A shader that can't work here, found before the GPU sees it. */
export class ShaderSourceError extends Error {}

/** The complete fragment shader for a definition. Throws a ShaderSourceError for Shadertoy code
 * that samples channels, which have nothing to sample. */
export function composeFragment(definition: ShaderDefinition): string {
  const source = definition.source.trim();
  const head = PRELUDE + paramUniforms(definition);
  switch (definition.dialect ?? "glsl") {
    case "glsl":
      return `${head}#line 1\n${source}\n`;
    case "shadertoy":
      if (/\biChannel\d/.test(source))
        throw new ShaderSourceError(
          `cardstock: shader "${definition.id}" samples iChannels; only single-pass Shadertoy code without inputs is supported.`,
        );
      return `${head}#define iTime uTime
#define iResolution vec3(uResolution, 1.0)
#define iMouse vec4(uPointer.x * uResolution.x, (1.0 - uPointer.y) * uResolution.y, 0.0, 0.0)
#define iFrame uFrame
#line 1
${source}
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  fragColor = vec4(color.rgb, 1.0);
}
`;
    case "twigl":
      // twigl's inputs are uniforms there; here they're globals set before the body runs, so the
      // one-letter names stay out of the preprocessor (a #define r would break every \`.r\`).
      return `${head}#define FC gl_FragCoord
vec2 r;
vec2 m;
float t;
float f;
${twiglHelpers(source)}void main() {
  r = uResolution;
  m = vec2(uPointer.x, 1.0 - uPointer.y);
  t = uTime;
  f = float(uFrame);
  vec4 o = vec4(0.0);
#line 1
${source}
  fragColor = vec4(o.rgb, 1.0);
}
`;
  }
}
