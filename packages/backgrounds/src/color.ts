/* The little colour maths the CLI needs: WCAG luminance and contrast, to check that the suggested
 * ink reads on the artwork, and OKLCH, to pick that ink. OKLCH keeps lightness perceptual, so
 * "near-white, faintly tinted toward the image" is one lightness and one small chroma whatever the
 * hue, where the same move in sRGB or HSL would come out brighter for some hues than others. */

export type Rgb = readonly [r: number, g: number, b: number];
export type Oklch = readonly [l: number, c: number, h: number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** sRGB 0..255 of a `#rgb` or `#rrggbb` hex; null for anything else. */
export function hexToRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!m) return null;
  const full = m.length === 3 ? [...m].map((c) => c + c).join("") : m;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as Rgb;
}

/** `#rrggbb`, lower case, with each channel rounded and clamped to 0..255. */
export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** An sRGB channel 0..255 to linear light 0..1. */
export const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Linear light 0..1 back to an sRGB channel 0..255. */
export const fromLinear = (v: number): number => {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return s * 255;
};

/** WCAG relative luminance, 0 (black) to 1 (white). The same formula as core's. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio of two luminances, 1 to 21. */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// Björn Ottosson's OKLab matrices, for sRGB in linear light.
function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH of an sRGB colour: lightness 0..1, chroma (0 to about 0.37), hue in degrees. */
export function rgbToOklch([r, g, b]: Rgb): Oklch {
  const [L, a, bb] = linearToOklab(toLinear(r), toLinear(g), toLinear(b));
  const c = Math.hypot(a, bb);
  const h = c < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return [L, c, h];
}

/** sRGB 0..255 of an OKLCH colour. Out-of-gamut colours are clipped per channel, which is fine
 * for the pale, barely tinted inks this is used for. */
export function oklchToRgb([L, c, h]: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const lin = oklabToLinear(L, c * Math.cos(rad), c * Math.sin(rad));
  return lin.map((v) => clamp(fromLinear(clamp(v, 0, 1)), 0, 255)) as unknown as Rgb;
}

// The suggested ink: near-white on dark artwork, near-black on light, both carrying a trace of the
// image's own hue so the text feels printed on it rather than pasted over it.
const INK_LIGHTNESS = { dark: 0.97, light: 0.18 } as const;
const INK_CHROMA = 0.02;

/** An ink for text on a background of `tone`, tinted toward `tint` (usually its dominant colour).
 * A grey tint gives a neutral ink. */
export function suggestInk(tone: "dark" | "light", tint: Rgb): string {
  const [, c, h] = rgbToOklch(tint);
  // A grey has no hue worth carrying; tinting toward hue 0 would turn it faintly pink.
  const chroma = c < 0.015 ? 0 : INK_CHROMA;
  return rgbToHex(oklchToRgb([INK_LIGHTNESS[tone], chroma, h]));
}
