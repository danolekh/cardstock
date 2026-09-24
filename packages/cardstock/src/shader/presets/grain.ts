/* Grain: a slow, matte gradient under heavy film grain, like a risograph print. */

import { defineShader, type ShaderDefinition } from "../define";

export const grain: ShaderDefinition<{
  colors: { type: "colors"; default: readonly string[]; min: 2; max: 5; label: "Colours" };
  softness: { type: "float"; default: 0.5; min: 0; max: 1; step: 0.01; label: "Softness" };
  noise: { type: "float"; default: 0.5; min: 0; max: 1; step: 0.01; label: "Grain" };
}> = defineShader({
  id: "grain",
  label: "Grain",
  description: "A calm gradient under film grain, like a riso print.",
  license: "MIT",
  still: 4,
  fps: 30,
  params: {
    colors: {
      type: "colors",
      default: ["#1c1340", "#e2572b", "#f6b26b", "#f3e3c7"],
      min: 2,
      max: 5,
      label: "Colours",
    },
    softness: { type: "float", default: 0.5, min: 0, max: 1, step: 0.01, label: "Softness" },
    noise: { type: "float", default: 0.5, min: 0, max: 1, step: 0.01, label: "Grain" },
  },
  source: `
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= .5;
  }
  return v;
}

vec3 ramp(float x) {
  float at = clamp(x, 0., 1.) * float(uColorsCount - 1);
  int i = int(floor(at));
  return mix(uColors[min(i, uColorsCount - 1)], uColors[min(i + 1, uColorsCount - 1)], smoothstep(0., 1., fract(at)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2(uv.x * uResolution.x / uResolution.y, uv.y) * 1.4 + uSeed * 11.;
  float t = uTime * .06;
  // Domain warping: the noise looked up through noise, so the bands melt into each other.
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3 - t)));
  float n = fbm(p + 1.8 * q + vec2(t * 1.7, -t));
  // A diagonal sweep underneath gives it a direction, the warp breaks it up.
  float x = mix(uv.y * .75 + uv.x * .25, n, .65);
  x = mix(smoothstep(.2, .8, x), x, uSoftness);
  vec3 color = ramp(x);
  // Grain in screen pixels, fixed in place: moving grain reads as noise, still grain as paper.
  float g = hash(floor(gl_FragCoord.xy)) - .5;
  color += g * uNoise * .28;
  color = mix(color, vec3(dot(color, vec3(.3, .59, .11))) * vec3(.85, .95, 1.1), .5 * uFreeze);
  fragColor = vec4(color, 1.);
}
`,
});
