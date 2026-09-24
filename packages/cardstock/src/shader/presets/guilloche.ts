/* Guilloché: the engraved rosettes of bank notes, turning slowly. Bands of rippling rings, each
 * drawn a few times out of phase so they braid, around a rosette of polar roses, over wave lines
 * that bend as they pass it: the same composition as cardstock's "guilloche" artwork, drawn per
 * pixel as distances to the curves. */

import { defineShader, type ShaderDefinition } from "../define";

export const guilloche: ShaderDefinition<{
  ground: { type: "color"; default: string; label: "Ground" };
  ink: { type: "color"; default: string; label: "Ink" };
  lines: { type: "float"; default: 7; min: 3; max: 10; step: 1; label: "Rings" };
  petals: { type: "float"; default: 18; min: 8; max: 32; step: 1; label: "Ripples" };
}> = defineShader({
  id: "guilloche",
  label: "Guilloché",
  description: "Engraved bank-note rosettes, turning slowly.",
  license: "MIT",
  tone: "dark",
  still: 0,
  params: {
    ground: { type: "color", default: "#10151d", label: "Ground" },
    ink: { type: "color", default: "#e3c98a", label: "Ink" },
    lines: { type: "float", default: 7, min: 3, max: 10, step: 1, label: "Rings" },
    petals: { type: "float", default: 18, min: 8, max: 32, step: 1, label: "Ripples" },
  },
  source: `
float px;

// A line "width" pixels wide, antialiased, from a distance in the artwork's units.
float stroke(float d, float width) {
  return 1. - smoothstep(width * .5, width * .5 + 1., abs(d) / px);
}

// The distance to a polar curve r(θ), from the radial gap and the curve's slope dr/dθ.
float polar(float rho, float r, float dr) {
  return (rho - r) / sqrt(1. + dr * dr / max(rho * rho, 1.));
}

void main() {
  // Laid out in the artwork's 1720×1080 space, measured by height.
  // A card is much smaller than the artwork's 1720px, so it's laid out a little closer in.
  float unit = 820. / uResolution.y;
  px = unit;
  vec2 q = gl_FragCoord.xy * unit;
  q.y = 820. - q.y;
  float width = uResolution.x * unit;
  vec2 c = vec2(width * .72, 820. * .52);
  vec2 d = q - c;
  float rho = length(d);
  float theta = atan(d.y, d.x);
  float t = uTime * .12;

  float ink = 0.;
  for (int k = 0; k < 10; k++) {
    if (float(k) >= uLines) break;
    float fk = float(k);
    float lobes = floor(uPetals + .5) + fk * 8.;
    float radius = 150. + fk * 92.;
    for (int j = 0; j < 3; j++) {
      float phase = float(j) / 3. * 6.28318 + t * (mod(fk, 2.) * 2. - 1.);
      float env = 40. * (1. + .28 * sin(3. * theta + fk));
      float wave = sin(lobes * theta + phase);
      float r = radius + env * wave;
      float dr = 40. * .84 * cos(3. * theta + fk) * wave + env * lobes * cos(lobes * theta + phase);
      ink = max(ink, stroke(polar(rho, r, dr), 1.) * (mod(fk, 5.) == 0. ? .7 : .42));
    }
  }

  // The rosette at the heart: petals of polar roses, a few out of phase so they interlace.
  for (int j = 0; j < 4; j++) {
    float a = 11. * theta + float(j) * .785 - t * .5;
    float r = 92. + 58. * cos(a);
    ink = max(ink, stroke(polar(rho, r, -58. * 11. * sin(a)), 1.) * .5 * smoothstep(0., 30., rho));
  }

  // Wave lines across the note, bending near the rosette.
  float spacing = 820. / 28.;
  for (int k = -1; k <= 1; k++) {
    float n = floor(q.y / spacing) + float(k);
    float y0 = n * spacing;
    float e = length(vec2(q.x, y0) - c) / 700.;
    float y = y0 + 16. * sin(q.x / 70. + n * .45 + t) * exp(-e * e) + 6. * sin(q.x / 190. + n);
    float dy = 16. / 70. * cos(q.x / 70. + n * .45 + t) * exp(-e * e) + 6. / 190. * cos(q.x / 190. + n);
    ink = max(ink, stroke((q.y - y) / sqrt(1. + dy * dy), .8) * .18);
  }

  // Fading from the rosette out, as the artwork's mask does.
  float fade = mix(1., .35, smoothstep(0., 1100., rho));
  vec3 ground = uGround * (1. + .5 * (1. - smoothstep(0., 1400., length(q - vec2(width * .3, 270.)))));
  vec3 color = mix(ground, uInk, ink * fade);
  color = mix(color, vec3(dot(color, vec3(.3, .59, .11))) * vec3(.85, .95, 1.1), .5 * uFreeze);
  fragColor = vec4(color, 1.);
}
`,
});
