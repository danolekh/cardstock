/* The manifest: what artwork a host offers and how to check each file. It's the catalogue `list`
 * shows and `add` downloads from, published beside the images (for the house art,
 * https://cardstock.danolekh.com/backgrounds/manifest.json). Each preset carries its background as
 * data, minus the image URLs: those depend on where the app serves the files, so `add` fills them
 * in. Every file has its size and SHA-256, so a download is verified before it lands. */

import { pathToFileURL } from "node:url";

import { parseCardBackground } from "@danolekh/cardstock/background";
import type {
  CardBackground,
  ImageBackground,
  LinearBackground,
  RadialBackground,
  ShaderBackground,
  SolidBackground,
} from "@danolekh/cardstock/background";

import { isHttp, readSource } from "./io.ts";

export const DEFAULT_MANIFEST = "https://cardstock.danolekh.com/backgrounds/manifest.json";

/** One encoded file of a preset: the same image at one width. */
export interface ManifestFile {
  /** A bare file name, relative to the manifest's `base`. */
  file: string;
  width: number;
  height: number;
  bytes: number;
  /** Lower-case hex SHA-256 of the file. */
  sha256: string;
}

/** A preset's background without its URLs (an image's, a shader's poster) and without its label
 * (the preset has one). */
export type ManifestBackground =
  | Omit<ImageBackground, "src" | "srcSet" | "label">
  | Omit<ShaderBackground, "poster" | "posterSrcSet" | "label">
  | Omit<SolidBackground, "label">
  | Omit<LinearBackground, "label">
  | Omit<RadialBackground, "label">;

export interface ManifestPreset {
  label: string;
  /** Loose descriptors for filtering: "foil", "light", "dark", "pattern", "gradient"… */
  tags: string[];
  background: ManifestBackground;
  /** The image (or a shader's poster) at each width, largest first by convention. Empty for a
   * gradient or a solid, and for a shader without a poster. */
  files: ManifestFile[];
}

export interface Manifest {
  version: 1;
  /** Where the files live: an absolute URL, or one relative to the manifest itself. */
  base: string;
  /** The licence of the artwork, as an SPDX identifier. */
  license: string;
  presets: Record<string, ManifestPreset>;
}

/** A manifest that didn't pass validation, with every problem found. */
export class ManifestError extends Error {
  readonly problems: string[];
  constructor(source: string, problems: string[]) {
    super(`${source} isn't a valid manifest:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ManifestError";
    this.problems = problems;
  }
}

export const PRESET_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
// A bare file name: nothing that could climb out of the directory it's written to.
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,127}\.(?:webp|avif|png|jpe?g)$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const TAG = /^[a-z0-9][a-z0-9-]{0,31}$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

/** The files ordered widest first, which is the `src`; the rest only appear in the `srcSet`. */
export const byWidth = (files: readonly ManifestFile[]): ManifestFile[] =>
  [...files].sort((a, b) => b.width - a.width);

/** `base` and `file` joined with one slash. */
export const joinUrl = (base: string, file: string): string => `${base.replace(/\/+$/, "")}/${file}`;

/** The URL of the widest file, and a srcset of them all when there's more than one. */
function urlsOf(files: readonly ManifestFile[], base: string) {
  const sorted = byWidth(files);
  const src = joinUrl(base, sorted[0]!.file);
  const srcSet =
    sorted.length > 1
      ? [...sorted]
          .reverse()
          .map((f) => `${joinUrl(base, f.file)} ${f.width}w`)
          .join(", ")
      : undefined;
  return { src, srcSet };
}

/** The full background for a preset, with its images served from `base` (a URL or a root-relative
 * path such as "/backgrounds"). Keys come out in reading order: type, label, then the paint. */
export function presetBackground(
  preset: Pick<ManifestPreset, "label" | "background" | "files">,
  base: string,
): CardBackground & { label: string } {
  const { type, ...rest } = preset.background;
  if (type === "shader") {
    if (!preset.files.length)
      return { type, label: preset.label, ...rest } as CardBackground & { label: string };
    const { src, srcSet } = urlsOf(preset.files, base);
    return {
      type,
      label: preset.label,
      ...(rest as Omit<ShaderBackground, "type">),
      poster: src,
      ...(srcSet ? { posterSrcSet: srcSet } : {}),
    };
  }
  if (type !== "image") return { type, label: preset.label, ...rest } as CardBackground & { label: string };
  const { src, srcSet } = urlsOf(preset.files, base);
  return {
    type,
    label: preset.label,
    src,
    ...(srcSet ? { srcSet } : {}),
    ...(rest as Omit<ImageBackground, "type" | "src" | "srcSet">),
  };
}

function checkFile(v: unknown, at: string, problems: string[]): v is ManifestFile {
  if (!isRecord(v)) return (problems.push(`${at} should be an object.`), false);
  const before = problems.length;
  if (typeof v.file !== "string" || !FILE_NAME.test(v.file))
    problems.push(`${at}.file should be a bare image file name, got ${JSON.stringify(v.file)}.`);
  for (const key of ["width", "height", "bytes"] as const)
    if (!isCount(v[key])) problems.push(`${at}.${key} should be a positive whole number.`);
  if (typeof v.sha256 !== "string" || !SHA256.test(v.sha256))
    problems.push(`${at}.sha256 should be 64 lower-case hex digits.`);
  return problems.length === before;
}

/** Checks a parsed manifest and returns it typed, or throws a `ManifestError` listing every
 * problem. Backgrounds go through core's `parseCardBackground` (with their URLs filled in), so a
 * manifest can't smuggle in a colour or URL the card would refuse. */
export function validateManifest(input: unknown, source = "The manifest"): Manifest {
  const problems: string[] = [];
  if (!isRecord(input)) throw new ManifestError(source, ["It should be a JSON object."]);
  if (input.version !== 1) problems.push(`version should be 1, got ${JSON.stringify(input.version)}.`);
  if (typeof input.base !== "string" || !input.base || /[\s"'<>\\]/.test(input.base))
    problems.push("base should be a URL.");
  if (typeof input.license !== "string" || !input.license) problems.push("license should be a string.");
  if (!isRecord(input.presets)) {
    problems.push("presets should be an object of presets by name.");
    throw new ManifestError(source, problems);
  }
  const presets: Record<string, ManifestPreset> = {};
  for (const [name, p] of Object.entries(input.presets)) {
    const at = `presets.${name}`;
    if (!PRESET_NAME.test(name)) problems.push(`${at}: names are lower-case letters, digits and dashes.`);
    if (!isRecord(p)) {
      problems.push(`${at} should be an object.`);
      continue;
    }
    const before = problems.length;
    if (typeof p.label !== "string" || !p.label || p.label.length > 80)
      problems.push(`${at}.label should be a string of up to 80 characters.`);
    if (!Array.isArray(p.tags) || !p.tags.every((t) => typeof t === "string" && TAG.test(t)))
      problems.push(`${at}.tags should be a list of short lower-case tags.`);
    const files: ManifestFile[] = [];
    if (!Array.isArray(p.files)) problems.push(`${at}.files should be a list.`);
    else p.files.forEach((f, i) => checkFile(f, `${at}.files[${i}]`, problems) && files.push(f));
    if (!isRecord(p.background)) {
      problems.push(`${at}.background should be an object.`);
      continue;
    }
    const bg = p.background;
    if ("src" in bg || "srcSet" in bg || "poster" in bg || "posterSrcSet" in bg)
      problems.push(`${at}.background: leave out src, srcSet, poster and posterSrcSet; files gives them.`);
    if (bg.type === "image" && Array.isArray(p.files) && !p.files.length)
      problems.push(`${at}: an image needs at least one file.`);
    if (bg.type !== "image" && bg.type !== "shader" && Array.isArray(p.files) && p.files.length)
      problems.push(`${at}: only an image or a shader's poster has files.`);
    if (problems.length > before) continue;
    const preset = { label: p.label as string, tags: p.tags as string[], files } as ManifestPreset;
    // A root-relative base is enough to exercise the URL rules on the file names.
    const parsed = parseCardBackground(presetBackground({ ...preset, background: bg as never }, "/b"));
    if (!parsed) {
      problems.push(`${at}.background isn't a valid card background (check its type, colours and position).`);
      continue;
    }
    const {
      label: _label,
      src: _src,
      srcSet: _srcSet,
      poster: _poster,
      posterSrcSet: _posterSrcSet,
      ...clean
    } = parsed as unknown as Record<string, unknown>;
    preset.background = clean as ManifestBackground;
    presets[name] = preset;
  }
  if (problems.length) throw new ManifestError(source, problems);
  return { version: 1, base: input.base as string, license: input.license as string, presets };
}

export interface LoadedManifest {
  manifest: Manifest;
  /** Where the files are: `manifest.base` resolved against the manifest's own location. */
  base: string;
  /** Where the manifest came from. */
  source: string;
}

/** Loads a manifest from a URL or a local path (the house manifest by default) and validates it. */
export async function loadManifest(source: string = DEFAULT_MANIFEST): Promise<LoadedManifest> {
  const bytes = await readSource(source);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(`${source} isn't JSON: ${(error as Error).message}`, { cause: error });
  }
  const manifest = validateManifest(json, source);
  const location = isHttp(source) || source.startsWith("file:") ? source : pathToFileURL(source).href;
  const base = new URL(manifest.base.endsWith("/") ? manifest.base : `${manifest.base}/`, location).href;
  return { manifest, base, source };
}
