/* Flow dots: a grid of dots, each nudged along a slowly turning noise field and brightest where
 * it lines up with it. After Anthony Fu's ArtDots on antfu.me (MIT), which moves its dots on the
 * CPU with pixi.js; here each pixel finds the dots near it on the GPU. */

import { defineShader, type ShaderDefinition } from "../define";

export const flowDots: ShaderDefinition<{
  ground: { type: "color"; default: string; label: "Ground" };
  dot: { type: "color"; default: string; label: "Dots" };
  spacing: { type: "float"; default: 9; min: 4; max: 32; step: 0.5; label: "Spacing (px)" };
  drift: { type: "float"; default: 0.5; min: 0; max: 1; step: 0.01; label: "Drift" };
}> = defineShader({
  id: "flow-dots",
  label: "Flow dots",
  description: "A quiet field of dots drifting on noise.",
  credit: "After Anthony Fu’s ArtDots (antfu.me)",
  license: "MIT",
  tone: "dark",
  still: 5,
  params: {
    ground: { type: "color", default: "#0e0f12", label: "Ground" },
    dot: { type: "color", default: "#d9dbe2", label: "Dots" },
    spacing: { type: "float", default: 9, min: 4, max: 32, step: 0.5, label: "Spacing (px)" },
    drift: { type: "float", default: 0.5, min: 0, max: 1, step: 0.01, label: "Drift" },
  },
  source: `
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth 3D value noise, -1..1.
float hash3(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3. - 2. * f);
  float n = mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), u.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), u.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
  return n * 2. - 1.;
}

void main() {
  // Spaced in CSS pixels, so a small card has fewer dots, not smaller ones.
  float cell = uSpacing * uPixelRatio;
  vec2 fc = gl_FragCoord.xy;
  float t = uTime * .1;
  float radius = max(.8, uPixelRatio * 1.1);
  float glow = 0.;
  // The dot of this cell and its neighbours: a nudge never carries one further than that.
  vec2 home = floor(fc / cell);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 id = home + vec2(i, j);
      vec2 c = (id + .5) * cell;
      // The field is measured in CSS pixels too, as ArtDots' is: one noise cell per 200px.
      vec2 q = c / uPixelRatio / 200. + uSeed * 13.;
      float angle = noise(vec3(q, t)) * 6.28318;
      float len = (noise(vec3(q, t * 2. + 7.)) * .5 + .5) * cell * .9 * uDrift;
      vec2 at = c + vec2(cos(angle), sin(angle)) * len;
      float alpha = (abs(cos(angle)) * .75 + .25) * (hash(id) * .4 + .6);
      glow = max(glow, alpha * (1. - smoothstep(radius - .75, radius + .75, length(fc - at))));
    }
  vec3 color = mix(uGround, uDot, glow);
  color = mix(color, vec3(dot(color, vec3(.3, .59, .11))) * vec3(.85, .95, 1.1), .5 * uFreeze);
  fragColor = vec4(color, 1.);
}
`,
});
