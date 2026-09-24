/* `add`: copies presets from a manifest into the app. Each image is downloaded, checked against
 * the manifest's size and SHA-256, and only then written, so a bad download never reaches the
 * app's public folder. Every file of every preset is fetched and checked before the first write,
 * so a failure part-way leaves the folder as it was. The presets then go into the presets file
 * with their URLs pointing where the app serves the files. */

import { join, resolve } from "node:path";

import { BUILT_IN_SHADERS, parseCardBackground } from "@danolekh/cardstock/background";
import type { CardBackground } from "@danolekh/cardstock/background";

import { checkBase, DEFAULT_DIR, defaultBase, defaultOut } from "./defaults.ts";
import { UsageError } from "./errors.ts";
import { readIfExists, readSource, sha256, writeAtomic } from "./io.ts";
import { joinUrl, loadManifest, presetBackground } from "./manifest.ts";
import type { LoadedManifest, ManifestFile } from "./manifest.ts";
import { writePresets } from "./presets-file.ts";
import type { MergeResult } from "./presets-file.ts";
import { closest } from "./suggest.ts";

export interface AddOptions {
  /** Add every preset in the manifest (then `names` may be empty). */
  all?: boolean;
  /** The manifest's URL or path; the house manifest by default. Or one already loaded. */
  manifest?: string | LoadedManifest;
  /** Where the images go; public/backgrounds by default. */
  dir?: string;
  /** The URL they're served from; `dir` without its leading public/ by default. */
  base?: string;
  /** Don't download: point the backgrounds at the manifest's own host. */
  remote?: boolean;
  /** The presets file; src/lib/card-backgrounds.ts (or lib/, without a src folder) by default. */
  out?: string;
  /** Write the presets file as JSON. */
  json?: boolean;
  /** Replace presets already in the presets file, and files that differ from the manifest's. */
  force?: boolean;
  /** Check everything and report what would change, but write nothing. */
  dryRun?: boolean;
  /** Resolves relative paths; the working directory by default. */
  cwd?: string;
}

export type FileStatus = "written" | "unchanged" | "would write";

export interface AddedPreset {
  name: string;
  background: CardBackground & { label: string };
  files: { file: string; path: string; bytes: number; status: FileStatus }[];
}

export interface AddResult {
  presets: AddedPreset[];
  /** Things to know that don't stop the add, such as a shader this cardstock doesn't ship. */
  warnings: string[];
  presetsFile: MergeResult & { path: string; created: boolean };
}

/** Adds presets from a manifest to the app: downloads and verifies their images, then merges
 * them into the presets file. */
export async function addPresets(names: readonly string[], options: AddOptions = {}): Promise<AddResult> {
  const cwd = options.cwd ?? process.cwd();
  const loaded =
    typeof options.manifest === "object" ? options.manifest : await loadManifest(options.manifest);
  const { presets } = loaded.manifest;

  const wanted = options.all ? Object.keys(presets) : [...new Set(names)];
  if (!wanted.length) throw new UsageError("Name the presets to add, or pass --all. `list` shows them.");
  const unknown = wanted.filter((n) => !Object.hasOwn(presets, n));
  if (unknown.length) {
    const lines = unknown.map((n) => {
      const guess = closest(n, Object.keys(presets));
      return `No preset called "${n}"${guess ? `; did you mean "${guess}"?` : "."}`;
    });
    throw new UsageError(`${lines.join("\n")}\nRun \`cardstock-backgrounds list\` to see them all.`);
  }

  const dir = resolve(cwd, options.dir ?? DEFAULT_DIR);
  const base = options.remote
    ? loaded.base.replace(/\/+$/, "")
    : checkBase(options.base ?? defaultBase(options.dir ?? DEFAULT_DIR, cwd));

  // Fetch and check everything first; write only once all of it is good.
  const pending: { path: string; bytes: Uint8Array }[] = [];
  const added: AddedPreset[] = [];
  const warnings: string[] = [];
  for (const name of wanted) {
    const preset = presets[name]!;
    const background = presetBackground(preset, base);
    // A newer manifest can name a shader an older cardstock doesn't have: the card shows the poster.
    if (
      background.type === "shader" &&
      !background.shader.includes("/") &&
      !(BUILT_IN_SHADERS as readonly string[]).includes(background.shader)
    )
      warnings.push(
        `"${name}" uses the "${background.shader}" shader, which this version of @danolekh/cardstock doesn't have; cards show its poster until you update.`,
      );
    if (!parseCardBackground(background))
      throw new Error(`"${name}" with base "${base}" isn't a valid card background; check --base.`);
    const files: AddedPreset["files"] = [];
    if (!options.remote)
      for (const file of preset.files) {
        const path = join(dir, file.file);
        const status = await fetchChecked(loaded, file, path, options.force ?? false, pending);
        files.push({
          file: file.file,
          path,
          bytes: file.bytes,
          status: options.dryRun && status === "written" ? "would write" : status,
        });
      }
    added.push({ name, background, files });
  }

  if (!options.dryRun) for (const { path, bytes } of pending) await writeAtomic(path, bytes);

  const out = resolve(cwd, options.out ?? defaultOut(options.json, cwd));
  const presetsFile = await writePresets(out, Object.fromEntries(added.map((p) => [p.name, p.background])), {
    force: options.force,
    json: options.json,
    dryRun: options.dryRun,
  });
  return { presets: added, warnings, presetsFile };
}

async function fetchChecked(
  loaded: LoadedManifest,
  file: ManifestFile,
  path: string,
  force: boolean,
  pending: { path: string; bytes: Uint8Array }[],
): Promise<FileStatus> {
  const existing = await readIfExists(path);
  if (existing && sha256(existing) === file.sha256) return "unchanged";
  if (existing && !force)
    throw new Error(
      `${path} already exists and isn't the manifest's ${file.file}. Pass --force to replace it.`,
    );
  const url = joinUrl(loaded.base, file.file);
  const bytes = await readSource(url);
  if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256)
    throw new Error(
      `${url} doesn't match the manifest (got ${bytes.byteLength} bytes, expected ${file.bytes}, or a different SHA-256). Nothing was written.`,
    );
  pending.push({ path, bytes });
  return "written";
}
