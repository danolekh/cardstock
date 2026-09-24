/* Liquid metal: brushed chrome whose reflections melt and run. The metal is a banded
 * environment (dark floor, bright horizon, sky) looked up through a warped surface; each channel
 * is looked up a hair apart, for the dispersion at the edges of the highlights. Tilting the card
 * slides the reflections across it. */

import { defineShader, type ShaderDefinition } from "../define";

export const liquidMetal: ShaderDefinition<{
  tint: { type: "color"; default: string; label: "Tint" };
  bands: { type: "float"; default: 3; min: 1; max: 8; step: 0.1; label: "Bands" };
  distortion: { type: "float"; default: 0.5; min: 0; max: 1; step: 0.01; label: "Distortion" };
}> = defineShader({
  id: "liquid-metal",
  label: "Liquid metal",
  description: "Chrome with reflections that melt, run and follow the tilt.",
  license: "MIT",
  still: 2,
  params: {
    tint: { type: "color", default: "#c9d1dc", label: "Tint" },
    bands: { type: "float", default: 3, min: 1, max: 8, step: 0.1, label: "Bands" },
    distortion: { type: "float", default: 0.5, min: 0, max: 1, step: 0.01, label: "Distortion" },
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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= .5;
  }
  return v;
}

// A studio environment along one axis, repeating: a dark floor rising to a bright sky, split by a
// hard horizon line, as polished chrome reflects it.
float env(float x) {
  float tri = abs(fract(x) - .5) * 2.;
  float base = mix(.42, .96, smoothstep(.12, .6, tri));
  float horizon = exp(-pow((tri - .52) * 26., 2.));
  return base + .35 * horizon - .18 * smoothstep(.52, .56, tri) * (1. - smoothstep(.56, .75, tri));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2(uv.x * uResolution.x / uResolution.y, uv.y);
  float t = uTime * .18;
  vec2 tilt = uTilt * vec2(1., -1.);

  // The surface: a gentle bulge, rippled by warped noise that drifts.
  vec2 w = vec2(fbm(p * 1.7 + vec2(t, -t * .6) + uSeed * 9.), fbm(p * 1.7 + vec2(-t * .8, t) + 4.1));
  float h = fbm(p * 1.2 + (w - .5) * 2.4 * uDistortion + t * .3);
  // Where the surface faces: its slope, plus how the card is held.
  float e = .03;
  float hx = fbm(p * 1.2 + vec2(e, 0.) + (w - .5) * 2.4 * uDistortion + t * .3) - h;
  float hy = fbm(p * 1.2 + vec2(0., e) + (w - .5) * 2.4 * uDistortion + t * .3) - h;
  vec2 n = vec2(hx, hy) / e * .12 * (.2 + uDistortion);

  float x = (p.y * .9 + p.x * .2) * uBands * .6 + n.y * 1.1 + n.x * .4 + tilt.y * .22 + tilt.x * .12 + (h - .5) * .9 * uDistortion;
  vec3 color = vec3(env(x - .006), env(x), env(x + .006));
  // Anisotropic brushing along the bands.
  color *= .96 + .04 * noise(vec2(gl_FragCoord.x * .02, gl_FragCoord.y * 1.5));
  // Tinted in the mids, white in the brightest highlights.
  color = mix(color * uTint, color, smoothstep(.8, 1.1, color.g));
  color = mix(color, vec3(dot(color, vec3(.3, .59, .11))) * vec3(.85, .95, 1.1), .5 * uFreeze);
  fragColor = vec4(clamp(color, 0., 1.), 1.);
}
`,
});
