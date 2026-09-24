/* `build`: prerenders the app's own image as a card background. The image is cropped once to the
 * card's ratio (around a focal point, or where sharp's attention or entropy strategy finds the
 * interest), and every width is scaled from that one crop, so the sizes in a srcSet show exactly
 * the same picture. Then the parts a background needs besides pixels are measured from it: the
 * colour to show while it loads, whether it reads light or dark, and an ink that stays legible
 * over its busiest area, not just its average. */

import { existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import { backgroundTone, parseCardBackground, parseRgb } from "@danolekh/cardstock/background";
import type { ImageBackground, Tone } from "@danolekh/cardstock/background";
import type { Sharp } from "sharp";

import { contrastRatio, fromLinear, luminance, rgbToHex, suggestInk, toLinear } from "./color.ts";
import type { Rgb } from "./color.ts";
import { checkBase, DEFAULT_DIR, defaultBase } from "./defaults.ts";
import { UsageError } from "./errors.ts";
import { readIfExists, sha256, writeAtomic } from "./io.ts";
import { joinUrl, PRESET_NAME } from "./manifest.ts";

/** The card's artwork size. The card itself is 85.6 × 53.98 mm (1.586); 1720 × 1080 is within a
 * pixel of that at a size that halves cleanly. */
export const WIDTH = 1720;
export const HEIGHT = 1080;
export const DEFAULT_SIZES = [1720, 860] as const;

// Text on a card is small; WCAG's 4.5:1 for normal text is the bar.
const MIN_CONTRAST = 4.5;
// The share of the image an ink is allowed to fall short on: specks and glints don't count.
const WORST_SHARE = 0.1;

export type Format = "webp" | "avif";

export interface BuildOptions {
  /** The preset's key; by default the file name, lower-cased and dashed. */
  name?: string;
  /** What stays in view: centre (default), top, bottom, left, right, a CSS-like "30% 60%", or
   * sharp's "attention" or "entropy" to find the interesting part. */
  position?: string;
  /** Widths to encode, e.g. [1720, 860]; heights follow the card's ratio. */
  sizes?: readonly number[];
  format?: Format;
  /** Encoder quality, 1..100; 82 by default. */
  quality?: number;
  /** Put a short content hash in each file name, so the files can be cached forever. */
  hash?: boolean;
  /** Overrides for what's measured. */
  tone?: Tone;
  ink?: string;
  label?: string;
  credit?: string;
  /** Where the images go; public/backgrounds by default. */
  dir?: string;
  /** The URL they're served from; `dir` without its leading public/ by default. */
  base?: string;
  /** Measure and report, but write nothing. */
  dryRun?: boolean;
  /** Resolves relative paths; the working directory by default. */
  cwd?: string;
}

export interface BuiltFile {
  file: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  status: "written" | "unchanged" | "would write";
}

export interface BuildResult {
  name: string;
  background: ImageBackground & { label: string };
  files: BuiltFile[];
  /** The most common colour (sharp's histogram), which tints the suggested ink. */
  dominant: string;
  /** The average colour, in linear light: the background's `color`, and what `tone` is read from. */
  mean: string;
  /** The ink's contrast with the worst tenth of the image; null for an ink that can't be measured. */
  contrast: number | null;
  warnings: string[];
}

type Crop = { kind: "focal"; x: number; y: number } | { kind: "strategy"; strategy: "attention" | "entropy" };

const KEYWORD: Record<string, [x: number | null, y: number | null]> = {
  centre: [0.5, 0.5],
  center: [0.5, 0.5],
  left: [0, null],
  right: [1, null],
  top: [null, 0],
  bottom: [null, 1],
};

/** Reads a --position: one or two keywords, or two percentages ("30% 60%"), or a strategy. */
export function parsePosition(position: string): Crop {
  const p = position.trim().toLowerCase();
  if (p === "attention" || p === "entropy") return { kind: "strategy", strategy: p };
  const parts = p.split(/\s+/);
  const percent = parts.map((t) => /^(\d+(?:\.\d+)?)%$/.exec(t)?.[1]);
  if (parts.length === 2 && percent.every((v) => v !== undefined)) {
    const [x, y] = percent.map((v) => Number(v) / 100) as [number, number];
    if (x <= 1 && y <= 1) return { kind: "focal", x, y };
  }
  if (parts.length <= 2 && parts.every((t) => t in KEYWORD)) {
    let x = 0.5;
    let y = 0.5;
    for (const t of parts) {
      const [kx, ky] = KEYWORD[t]!;
      if (kx !== null) x = kx;
      if (ky !== null) y = ky;
    }
    return { kind: "focal", x, y };
  }
  throw new UsageError(
    `--position should be centre, top, bottom, left, right, attention, entropy or two percentages like "30% 60%", got "${position}".`,
  );
}

/** The CSS object-position that matches a crop, or undefined for the middle (the default) and for
 * a strategy, whose crop already holds what matters. */
function cssPosition(crop: Crop): string | undefined {
  if (crop.kind === "strategy" || (crop.x === 0.5 && crop.y === 0.5)) return undefined;
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  return `${pct(crop.x)} ${pct(crop.y)}`;
}

/** "guilloche-sand" → "Guilloche Sand". */
export const titleCase = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");

/** A file name as a preset key: lower case, dashes for anything else. */
export const slug = (file: string): string =>
  basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export function parseSizes(sizes: readonly number[]): number[] {
  const unique = [...new Set(sizes)].sort((a, b) => b - a);
  if (!unique.length || !unique.every((w) => Number.isInteger(w) && w >= 16 && w <= 8192))
    throw new UsageError("--sizes should be widths in pixels between 16 and 8192, e.g. 1720,860.");
  return unique;
}

async function loadSharp(): Promise<(typeof import("sharp"))["default"]> {
  try {
    return (await import("sharp")).default;
  } catch (error) {
    throw new Error(
      "build needs sharp, which didn't load. Reinstall @danolekh/cardstock-backgrounds, or run `npm install sharp`.",
      { cause: error },
    );
  }
}

/** Crops, encodes and measures one image; writes its files into `dir` (unless `dryRun`). The
 * presets file is left to the caller. */
export async function buildBackground(
  input: string | Uint8Array,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const sharp = await loadSharp();
  const cwd = options.cwd ?? process.cwd();
  const warnings: string[] = [];

  const name = options.name ?? (typeof input === "string" ? slug(input) : "");
  if (!PRESET_NAME.test(name))
    throw new UsageError(
      name
        ? `"${name}" can't be a preset name: use lower-case letters, digits and dashes (--name).`
        : "Give the image a --name.",
    );
  const crop = parsePosition(options.position ?? "centre");
  const sizes = parseSizes(options.sizes ?? DEFAULT_SIZES);
  const format = options.format ?? "webp";
  if (format !== "webp" && format !== "avif")
    throw new UsageError(`--format should be webp or avif, got "${format}".`);
  const quality = options.quality ?? 82;
  if (!Number.isInteger(quality) || quality < 1 || quality > 100)
    throw new UsageError("--quality should be a whole number from 1 to 100.");
  // Check the overrides before any work, so a typo doesn't cost an encode.
  const overrides = parseCardBackground({
    type: "image",
    src: "/x.webp",
    color: "#000",
    ink: options.ink,
    tone: options.tone,
    label: options.label,
    credit: options.credit,
  });
  if (!overrides)
    throw new UsageError(
      "Check --ink (a plain colour such as #f4f1e8), --tone (light or dark), --label (up to 80 characters) and --credit (up to 200).",
    );
  const dirOption = options.dir ?? DEFAULT_DIR;
  const base = checkBase(options.base ?? defaultBase(dirOption, cwd));
  const dir = resolve(cwd, dirOption);

  // Decode once, upright, to raw pixels; every later step starts from these.
  const source = typeof input === "string" ? resolve(cwd, input) : input;
  if (typeof source === "string" && !existsSync(source)) throw new UsageError(`No file at ${input}.`);
  let decoded: { data: Buffer; info: import("sharp").OutputInfo };
  try {
    decoded = await sharp(source)
      .autoOrient()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    const what = typeof input === "string" ? input : "The image";
    throw new Error(`${what} couldn't be read as an image: ${(error as Error).message}`, { cause: error });
  }
  const { width: sw, height: sh, channels } = decoded.info;
  const raw = (data: Buffer, width: number, height: number, ch: number): Sharp =>
    sharp(data, { raw: { width, height, channels: ch as 1 | 2 | 3 | 4 } });
  let pixels = raw(decoded.data, sw, sh, channels);
  if (channels === 4 || channels === 2) {
    // A card is opaque; see-through parts would show whatever's behind the card.
    warnings.push("has transparency; flattened onto black");
    pixels = pixels.flatten({ background: "#000000" });
  }

  const [W, H] = [sizes[0]!, Math.round((sizes[0]! * HEIGHT) / WIDTH)];
  const ratio = WIDTH / HEIGHT;
  let largest: Sharp;
  if (crop.kind === "focal") {
    const cw = sw / sh > ratio ? Math.round(sh * ratio) : sw;
    const ch = sw / sh > ratio ? sh : Math.round(sw / ratio);
    const region = {
      left: Math.round((sw - cw) * crop.x),
      top: Math.round((sh - ch) * crop.y),
      width: cw,
      height: ch,
    };
    largest = pixels.extract(region).resize(W, H, { fit: "fill" });
    if (cw < W) warnings.push(`is ${sw}×${sh}, so the ${W}px file is upscaled`);
  } else {
    largest = pixels.resize(W, H, { fit: "cover", position: sharp.strategy[crop.strategy] });
    if (sw < W || sh < H) warnings.push(`is ${sw}×${sh}, so the ${W}px file is upscaled`);
  }
  const cropped = await largest.removeAlpha().raw().toBuffer();
  const fromCrop = () => raw(cropped, W, H, 3);

  // Measure.
  const { dominant: d } = await fromCrop().stats();
  const dominant: Rgb = [d.r, d.g, d.b];
  const small = await fromCrop().resize(64, 40, { fit: "fill" }).raw().toBuffer();
  const lums: number[] = [];
  const sum = [0, 0, 0];
  for (let i = 0; i < small.length; i += 3) {
    const px: Rgb = [small[i]!, small[i + 1]!, small[i + 2]!];
    lums.push(luminance(px));
    for (let c = 0; c < 3; c++) sum[c]! += toLinear(px[c]!);
  }
  const count = lums.length;
  const mean = rgbToHex(sum.map((s) => fromLinear(s / count)) as unknown as Rgb);
  const tone = options.tone ?? backgroundTone({ type: "solid", color: mean });
  const ink = options.ink ?? suggestInk(tone, dominant);

  // Contrast against the worst tenth: the brightest areas for a light ink, the darkest for a dark
  // one. An average would pass artwork whose highlights swallow the card number.
  let contrast: number | null = null;
  const inkRgb = parseRgb(ink);
  if (inkRgb) {
    const inkLum = luminance(inkRgb);
    lums.sort((a, b) => a - b);
    const meanLum = lums.reduce((a, b) => a + b, 0) / count;
    const worst =
      inkLum > meanLum
        ? lums[Math.floor((1 - WORST_SHARE) * (count - 1))]!
        : lums[Math.floor(WORST_SHARE * (count - 1))]!;
    contrast = Math.round(contrastRatio(inkLum, worst) * 100) / 100;
    if (contrast < MIN_CONTRAST)
      warnings.push(
        `ink ${ink} has only ${contrast}:1 contrast over its worst areas (${MIN_CONTRAST}:1 is the bar); try another --ink or --position, or calm the image`,
      );
  }

  // Encode.
  const ext = format;
  const files: BuiltFile[] = [];
  for (const w of sizes) {
    const h = Math.round((w * HEIGHT) / WIDTH);
    let img = w === W ? fromCrop() : fromCrop().resize(w, h, { fit: "fill" });
    img =
      format === "webp"
        ? img.webp({ quality, effort: 6, smartSubsample: true })
        : img.avif({ quality, effort: 4 });
    const bytes = await img.toBuffer();
    const hash = sha256(bytes);
    const stem = w === W ? name : `${name}-${w}`;
    const file = options.hash ? `${stem}.${hash.slice(0, 8)}.${ext}` : `${stem}.${ext}`;
    const path = join(dir, file);
    const existing = await readIfExists(path);
    const same = existing !== null && sha256(existing) === hash;
    if (!same && !options.dryRun) await writeAtomic(path, bytes);
    files.push({
      file,
      path,
      width: w,
      height: h,
      bytes: bytes.byteLength,
      sha256: hash,
      status: same ? "unchanged" : options.dryRun ? "would write" : "written",
    });
  }

  const position = cssPosition(crop);
  const background: ImageBackground & { label: string } = {
    type: "image",
    label: options.label ?? titleCase(name),
    src: joinUrl(base, files[0]!.file),
    ...(files.length > 1
      ? {
          srcSet: [...files]
            .reverse()
            .map((f) => `${joinUrl(base, f.file)} ${f.width}w`)
            .join(", "),
        }
      : {}),
    ...(position ? { position } : {}),
    color: mean,
    tone,
    ink,
    ...(options.credit ? { credit: options.credit } : {}),
  };
  if (!parseCardBackground(background))
    throw new UsageError(
      `The background for "${name}" isn't valid: check --ink (a plain colour), --label (up to 80 characters) and --credit (up to 200).`,
    );
  return { name, background, files, dominant: rgbToHex(dominant), mean, contrast, warnings };
}
