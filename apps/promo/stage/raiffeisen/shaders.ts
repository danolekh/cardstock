/* Shaders in Raiffeisen's visual language, for the pitch video: its yellows (the core one and the
 * warmer ones that support it), warm off-black, and the diagonals the brand lays everything out
 * along, the echo of its gable cross (never the cross itself, which is their trademark). The more
 * premium the card, the more striking its pattern: classic is quiet yellow plastic, premium a
 * drifting moiré. Design concepts, not the bank's own artwork. Registered with <ShaderLibrary>
 * under "rb/…", the way any app brings its own shaders to cardstock. */
import { defineShader, type ShaderDefinition } from "@danolekh/cardstock/shader";

const HASH = `
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

/** Everyday debit: glossy yellow plastic in three diagonal blocks, a satin sheen crossing it. */
export const classic: ShaderDefinition = defineShader({
  id: "rb/classic",
  label: "Classic",
  tone: "light",
  still: 7.5,
  params: {
    colors: { type: "colors", default: ["#fffb8f", "#fbf315", "#e9e215"], min: 3, max: 3 },
    sheen: { type: "float", default: 0.5, min: 0, max: 1 },
  },
  source: `${HASH}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  // Along the diagonal, bottom left to top right, 0..1.
  float d = (uv.x * aspect + uv.y) / (aspect + 1.);
  // Three blocks, the layouts' rule, with soft seams that lean a little with the tilt.
  float seam = .012;
  float lean = uTilt.x * .02;
  vec3 color = mix(uColors[0], uColors[1], smoothstep(.34 - seam, .34 + seam, d + lean));
  color = mix(color, uColors[2], smoothstep(.7 - seam, .7 + seam, d + lean));
  // A satin sheen: a broad soft band travelling along the diagonal, and the tilt moves it.
  float at = fract(uTime * .07) * 1.9 - .45 + uTilt.x * .18 - uTilt.y * .1;
  float band = exp(-pow((d - at) * 5.5, 2.)) + .5 * exp(-pow((d - at + .09) * 16., 2.));
  color = mix(color, vec3(1., 1., .92), band * .42 * uSheen);
  // Lit from above, like a card on a desk.
  color *= .94 + .08 * uv.y;
  // The plastic's own faint grain.
  color += (hash(floor(gl_FragCoord.xy)) - .5) * .018;
  fragColor = vec4(color, 1.);
}
`,
});

/** Gold: fine luminous ribbons folding into a roof line under the ridge, rising slowly and fading
 * into warm off-black. */
export const gable: ShaderDefinition = defineShader({
  id: "rb/gable",
  label: "Gable",
  tone: "dark",
  still: 3,
  params: {
    ground: { type: "color", default: "#12110d" },
    colors: { type: "colors", default: ["#fbf315", "#f5b800"], min: 2, max: 2 },
  },
  source: `${HASH}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  // The ridge sits right of centre and above the card; the tilt nudges it.
  vec2 apex = vec2(aspect * .68 + uTilt.x * .06, 1.12 - uTilt.y * .04);
  // Lines of equal v are roof shapes: the height below the ridge along both slopes.
  float v = (apex.y - p.y) - abs(p.x - apex.x) * .85;
  float s = v * 7. + uTime * .12;
  float id = floor(s);
  float f = fract(s);
  // A thin folded strip in each step: a bright crease with a soft glow either side.
  float px = fwidth(s);
  float crease = smoothstep(.035 + px, .035, abs(f - .5)) + .4 * exp(-pow((f - .5) * 8., 2.));
  vec3 tint = mix(uColors[0], uColors[1], mod(id, 2.));
  // Bright under the ridge, sinking into the dark further down.
  float fade = pow(smoothstep(1.5, 0., v), 1.6);
  vec3 color = uGround * (1. + .6 * fade);
  color += tint * crease * fade * .95;
  color += (hash(floor(gl_FragCoord.xy)) - .5) * .02;
  fragColor = vec4(color, 1.);
}
`,
});

/** Business: "make it happen", a quiet grid of small chevrons pointing up and to the right, and a
 * wave of light passing through them in that direction. */
export const arrows: ShaderDefinition = defineShader({
  id: "rb/arrows",
  label: "Arrows",
  tone: "dark",
  still: 2.5,
  params: {
    ground: { type: "color", default: "#23211d" },
    arrow: { type: "color", default: "#fbf315" },
  },
  source: `${HASH}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  // Along the march (45° up-right) and across it.
  vec2 q = vec2(p.x + p.y, p.y - p.x) * .7071;
  float cells = 9.;
  vec2 cell = fract(q * cells) - .5;
  vec2 id = floor(q * cells);
  // A chevron in each cell, pointing along the march: two short strokes meeting at its tip.
  float chevron = abs(cell.x + abs(cell.y) * .9 - .05);
  float px = fwidth(q.x * cells);
  float stroke = smoothstep(.045 + px, .045, chevron) * step(abs(cell.y), .24);
  // The light: a wave rolling up the diagonal, so each row lights up in turn.
  float wave = pow(.5 + .5 * sin(q.x * 6. - uTime * 1.3), 6.);
  float rest = .1 + .06 * hash(id);
  vec3 color = uGround * (1.12 - .25 * uv.x);
  color = mix(color, uArrow, stroke * (rest + .85 * wave));
  // A soft glow around the lit rows.
  color += uArrow * wave * .035;
  color += (hash(floor(gl_FragCoord.xy)) - .5) * .02;
  fragColor = vec4(color, 1.);
}
`,
});

/** Premium: gold hairlines crossing in a fine diamond lattice, each family beating against a copy
 * of itself turned a few degrees, so broad diamonds of light drift across the black; a gold glow
 * sweeps with the tilt. */
export const premium: ShaderDefinition = defineShader({
  id: "rb/premium",
  label: "Premium",
  tone: "dark",
  still: 4,
  params: {
    ground: { type: "color", default: "#070706" },
    line: { type: "color", default: "#e8c96a" },
  },
  source: `${HASH}
// A family of hairlines along angle a: its lines, and its beat with the same lines turned by b.
vec2 family(vec2 p, float a, float b, float density) {
  float s = dot(p, vec2(cos(a), sin(a))) * density;
  float t = dot(p, vec2(cos(a + b), sin(a + b))) * density;
  float line = smoothstep(fwidth(s) * 1.1, 0., abs(fract(s) - .5) - .015);
  float beat = .5 + .5 * cos((s - t) * 6.2832);
  return vec2(line, beat);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - .5) * vec2(aspect, 1.);
  // About one line every 6 CSS px.
  float density = uResolution.y / uPixelRatio / 6.;
  float turn = .03 + .012 * sin(uTime * .21);
  vec2 a = family(p + vec2(uTime * .006, 0.), .785, turn, density);
  vec2 b = family(p, -.785, -turn * 1.3, density);
  // The lines show where their beat is high: diamonds of light where both families agree.
  float lattice = a.x * pow(a.y, 2.) + b.x * pow(b.y, 2.);
  float d = dot(p, vec2(.7071, .7071)) - (uTilt.x * .3 - uTilt.y * .18) - sin(uTime * .25) * .12;
  float light = exp(-d * d * 5.);
  vec3 color = uGround + uLine * lattice * (.35 + .65 * light) * .9;
  color += uLine * light * .06;
  color += (hash(floor(gl_FragCoord.xy)) - .5) * .015;
  fragColor = vec4(color, 1.);
}
`,
});

export const RB_SHADERS: readonly ShaderDefinition[] = [classic, gable, arrows, premium];
