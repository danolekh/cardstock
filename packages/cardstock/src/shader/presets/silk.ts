/* Silk: folds of fabric catching the light. Coordinates are pushed through layers of sine waves,
 * each turned and finer than the last, the "turbulence" technique Xor teaches in GM Shaders
 * (https://mini.gmshaders.com/p/turbulence); the code here is our own. */

import { defineShader, type ShaderDefinition } from "../define";

export const silk: ShaderDefinition<{
  colors: { type: "colors"; default: readonly string[]; min: 2; max: 6; label: "Colours" };
  turbulence: { type: "float"; default: 0.6; min: 0; max: 1.5; step: 0.01; label: "Turbulence" };
  scale: { type: "float"; default: 1; min: 0.4; max: 2.5; step: 0.01; label: "Scale" };
}> = defineShader({
  id: "silk",
  label: "Silk",
  description: "Flowing folds of fabric, lit along their ridges.",
  credit: "Technique: turbulence, from Xor’s GM Shaders",
  license: "MIT",
  tone: "dark",
  still: 3,
  params: {
    colors: {
      type: "colors",
      default: ["#120c2c", "#4b2aa8", "#b25cff", "#ff9bd2"],
      min: 2,
      max: 6,
      label: "Colours",
    },
    turbulence: { type: "float", default: 0.6, min: 0, max: 1.5, step: 0.01, label: "Turbulence" },
    scale: { type: "float", default: 1, min: 0.4, max: 2.5, step: 0.01, label: "Scale" },
  },
  source: `
// The palette as a gradient over 0..1.
vec3 ramp(float x) {
  float n = float(uColorsCount - 1);
  float at = clamp(x, 0., 1.) * n;
  int i = int(floor(at));
  vec3 a = uColors[min(i, uColorsCount - 1)];
  vec3 b = uColors[min(i + 1, uColorsCount - 1)];
  return mix(a, b, smoothstep(0., 1., fract(at)));
}

// The sheet's height: the point pushed through the turbulence, then long folds along the flow.
float sheet(vec2 p, float t) {
  float freq = 1.6;
  mat2 turn = mat2(.6, -.8, .8, .6);
  mat2 rot = mat2(1.);
  for (float i = 0.; i < 8.; i++) {
    float phase = freq * (p * rot).y + t * (1. + .15 * i) + i;
    p += uTurbulence * rot[0] * sin(phase) / freq;
    rot *= turn;
    freq *= 1.35;
  }
  return sin(p.x * 2.2 + p.y * .9);
}

void main() {
  vec2 uv = (2. * gl_FragCoord.xy - uResolution) / uResolution.y;
  vec2 p = uv * 1.3 / uScale + uSeed * 7.;
  float t = uTime * .35;

  // Light the sheet as a surface: its normal from the slope of the height.
  float e = 2. / uResolution.y;
  float h = sheet(p, t);
  vec2 slope = vec2(sheet(p + vec2(e, 0.), t) - h, sheet(p + vec2(0., e), t) - h) / e;
  vec3 n = normalize(vec3(-slope * .12, 1.));
  vec3 light = normalize(vec3(-.5, .6, .65));
  float diffuse = max(0., dot(n, light));
  float spec = pow(max(0., dot(reflect(-light, n), vec3(0., 0., 1.))), 18.);

  vec3 color = ramp(.15 + .6 * (.5 + .5 * h) * diffuse + .12 * uv.y);
  color *= .55 + .6 * diffuse;
  color += spec * .45 * mix(vec3(1.), ramp(1.), .4);
  // A soft vignette keeps the edges for the card's text.
  color *= 1. - .22 * dot(uv * vec2(.55, .8), uv * vec2(.55, .8));
  color = mix(color, vec3(dot(color, vec3(.3, .59, .11))) * vec3(.85, .95, 1.1), .5 * uFreeze);
  fragColor = vec4(clamp(color, 0., 1.), 1.);
}
`,
});
