/* Holographic foil: thin-film iridescence over a silvery base, with glitter. The colour comes
 * from where each point faces, so tilting the card sweeps the rainbow across it; the palette is
 * Inigo Quilez's cosine palette (https://iquilezles.org/articles/palettes/, MIT). */

import { defineShader, type ShaderDefinition } from "../define";

export const holoFoil: ShaderDefinition<{
  base: { type: "color"; default: string; label: "Base" };
  intensity: { type: "float"; default: 0.75; min: 0; max: 1; step: 0.01; label: "Intensity" };
  bands: { type: "float"; default: 2.5; min: 0.5; max: 6; step: 0.1; label: "Bands" };
}> = defineShader({
  id: "holo-foil",
  label: "Holo foil",
  description: "Iridescent foil and glitter that sweep with the tilt.",
  license: "MIT",
  tone: "light",
  still: 1,
  params: {
    base: { type: "color", default: "#d7d6e4", label: "Base" },
    intensity: { type: "float", default: 0.75, min: 0, max: 1, step: 0.01, label: "Intensity" },
    bands: { type: "float", default: 2.5, min: 0.5, max: 6, step: 0.1, label: "Bands" },
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

// iq's cosine palette, tuned to a foil's pastel rainbow.
vec3 film(float x) {
  return .72 + .28 * cos(6.28318 * (x + vec3(0., .33, .67)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - .5) * vec2(aspect, 1.);
  vec2 tilt = uTilt * vec2(1., -1.);
  float t = uTime * .05;

  // How each point faces: a diagonal sweep, a soft wobble, and the hand holding it.
  float wobble = noise(p * 2.2 + t + uSeed * 5.) + .5 * noise(p * 5. - t);
  float facing = dot(p, vec2(.8, .55)) + wobble * .35 + dot(tilt, vec2(.45, .3)) + t * .6;
  vec3 rainbow = film(facing * uBands);

  // Where the light catches: a bright band that follows the pointer.
  vec2 light = (vec2(uPointer.x, 1. - uPointer.y) - .5) * vec2(aspect, 1.);
  float d = dot(p - light, normalize(vec2(.8, .55)));
  float band = exp(-d * d * 10.);

  vec3 color = mix(uBase, uBase * rainbow * 1.25, uIntensity * (.55 + .45 * band));
  color += band * .18 * uIntensity;

  // Glitter: tiny flakes, each flashing when the tilt turns it to the light.
  vec2 cell = floor(gl_FragCoord.xy / 3.);
  float flake = hash(cell + floor(uSeed * 100.));
  float glint = pow(max(0., sin(flake * 40. + facing * 18.)), 24.) * step(.9, flake);
  color += glint * .45 * uIntensity;

  color = mix(color, vec3(dot(color, vec3(.3, .59, .11))) * vec3(.85, .95, 1.1), .5 * uFreeze);
  fragColor = vec4(clamp(color, 0., 1.), 1.);
}
`,
});
