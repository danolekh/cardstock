/* A mesh gradient: colour spots drifting on their own paths, blended by inverse distance and bent
 * by a slow organic distortion and a swirl. Ported from Paper Shaders' "Mesh Gradient"
 * (https://github.com/paper-design/shaders, Apache License 2.0, © Paper Design); see NOTICE. Their
 * sizing system is replaced by the card's own box, and the grain is Paper's overlay grain. */

import { defineShader, type ShaderDefinition } from "../define";

export const mesh: ShaderDefinition<{
  colors: { type: "colors"; default: readonly string[]; min: 2; max: 8; label: "Colours" };
  distortion: { type: "float"; default: 0.8; min: 0; max: 1; step: 0.01; label: "Distortion" };
  swirl: { type: "float"; default: 0.1; min: 0; max: 1; step: 0.01; label: "Swirl" };
  grain: { type: "float"; default: 0.15; min: 0; max: 1; step: 0.01; label: "Grain" };
}> = defineShader({
  id: "mesh",
  label: "Mesh",
  description: "Soft colour spots drifting and blending: the brand-colour workhorse.",
  credit: "Ported from Paper Shaders’ Mesh Gradient",
  license: "Apache-2.0",
  still: 2,
  params: {
    colors: {
      type: "colors",
      default: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"],
      min: 2,
      max: 8,
      label: "Colours",
    },
    distortion: { type: "float", default: 0.8, min: 0, max: 1, step: 0.01, label: "Distortion" },
    swirl: { type: "float", default: 0.1, min: 0, max: 1, step: 0.01, label: "Swirl" },
    grain: { type: "float", default: 0.15, min: 0, max: 1, step: 0.01, label: "Grain" },
  },
  source: `
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + fract(float(i) / 3.) * .9;
  float c = .8 + fract(float(i + 1) / 4.);
  return .5 + .5 * vec2(sin(t * b + a), cos(t * c + a * 1.5));
}

void main() {
  // The card's box as 0..1, with the shorter side's scale kept so spots stay round.
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  uv.x = (uv.x - .5) * min(aspect, 1.6) / 1.6 + .5;
  vec2 grainUV = gl_FragCoord.xy / uResolution.y * 1000.;

  float t = .5 * (uTime + 41.5);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += uDistortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
    uv.y += uDistortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec2 uvRotated = rotate(uv - .5, -3. * uSwirl * radius) + .5;

  vec3 color = vec3(0.);
  float totalWeight = 0.;
  for (int i = 0; i < 8; i++) {
    if (i >= uColorsCount) break;
    float dist = pow(length(uvRotated - getPosition(i, t)), 3.5);
    float weight = 1. / (dist + 1e-3);
    color += uColors[i] * weight;
    totalWeight += weight;
  }
  color /= max(1e-4, totalWeight);

  if (uGrain > 0.) {
    float g = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    g = mix(g, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    g = pow(g, 1.3) * 2. - 1.;
    color = mix(color, vec3(step(0., g)), .35 * pow(uGrain * abs(g), .8));
  }
  fragColor = vec4(color, 1.);
}
`,
});
