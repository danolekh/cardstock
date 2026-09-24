#!/usr/bin/env node
/* cardstock-backgrounds: card backgrounds on demand. `list` shows what a manifest offers, `add`
 * copies presets into the app (images into its public folder, data into its presets file), and
 * `build` prerenders the app's own images the same way. Arguments are parsed with node:util, so
 * the CLI has no dependencies beyond sharp, which only `build` loads. */

import { createRequire } from "node:module";
import { relative } from "node:path";
import { parseArgs } from "node:util";
import type { ParseArgsConfig } from "node:util";

import type { Tone } from "@danolekh/cardstock/background";

import { addPresets } from "./add.ts";
import { buildBackground, parseSizes, slug } from "./build.ts";
import type { BuildResult, Format } from "./build.ts";
import { DEFAULT_DIR, defaultOut } from "./defaults.ts";
import { UsageError } from "./errors.ts";
import { readIfExists } from "./io.ts";
import { DEFAULT_MANIFEST, loadManifest } from "./manifest.ts";
import { presetKeys, writePresets } from "./presets-file.ts";
import type { MergeResult } from "./presets-file.ts";
import { closest } from "./suggest.ts";

const HELP = `cardstock-backgrounds: card backgrounds for @danolekh/cardstock

Usage
  cardstock-backgrounds list [--json] [--manifest <url|path>]
  cardstock-backgrounds add <name…> [--all] [options]
  cardstock-backgrounds build <image…> [options]

Commands
  list     Show the presets a manifest offers (the house artwork by default).
  add      Download presets into your app, check each file's SHA-256, and add them to
           your presets file.
  build    Prerender your own images at the card's size (1720×1080 and 860×540), work
           out their colour, tone and ink, and add them to your presets file.

Where things go (add, build)
  --dir <path>       Where the images are written. Default: ${DEFAULT_DIR}
  --base <url|path>  The URL they're served from. Default: --dir without its leading
                     public/, e.g. /backgrounds. An https: URL for a CDN.
  --out <file>       The presets file. Default: src/lib/card-backgrounds.ts, or
                     lib/card-backgrounds.ts when there's no src folder.
  --json             Write the presets file as a JSON object (default name .json).
  --force            Replace presets already in the file, and files that differ.
  --dry-run          Show what would change; write nothing.

add
  --all              Every preset in the manifest.
  --remote           Don't download: point the presets at the manifest's host.
  --manifest <src>   Default: ${DEFAULT_MANIFEST}

build
  --name <key>       The preset's key (one image only). Default: the file name.
  --position <p>     What stays in view: centre, top, bottom, left, right,
                     attention, entropy, or "30% 60%". Default: centre.
  --sizes <w,w>      Widths to encode. Default: 1720,860.
  --format <f>       webp or avif. Default: webp.
  --quality <n>      1-100. Default: 82.
  --hash             Put a content hash in each file name, for immutable caching.
  --tone <t>         light or dark, instead of the measured one.
  --ink <colour>     The text colour, instead of the suggested one.
  --label <text>     The name to show in a picker. Default: the key in Title Case.
  --credit <text>    Attribution to keep with the artwork.

  -h, --help         Show this help.
  -v, --version      Show the version.

Examples
  npx @danolekh/cardstock-backgrounds add holo aurora
  npx @danolekh/cardstock-backgrounds build art/ocean.jpg --position top --hash
`;

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  json: { type: "boolean" },
  manifest: { type: "string" },
  all: { type: "boolean" },
  remote: { type: "boolean" },
  dir: { type: "string" },
  base: { type: "string" },
  out: { type: "string" },
  force: { type: "boolean" },
  "dry-run": { type: "boolean" },
  name: { type: "string" },
  position: { type: "string" },
  sizes: { type: "string" },
  format: { type: "string" },
  quality: { type: "string" },
  hash: { type: "boolean" },
  tone: { type: "string" },
  ink: { type: "string" },
  label: { type: "string" },
  credit: { type: "string" },
} satisfies ParseArgsConfig["options"];

type Flag = keyof typeof OPTIONS;
const COMMANDS = ["list", "add", "build"] as const;
// Which flags each command takes, so a flag meant for another one is caught, not ignored.
const ALLOWED: Record<(typeof COMMANDS)[number], Flag[]> = {
  list: ["json", "manifest"],
  add: ["all", "remote", "manifest", "dir", "base", "out", "json", "force", "dry-run"],
  build: [
    "name",
    "position",
    "sizes",
    "format",
    "quality",
    "hash",
    "tone",
    "ink",
    "label",
    "credit",
    "dir",
    "base",
    "out",
    "json",
    "force",
    "dry-run",
  ],
};

/** This package's version, from the nearest package.json up from here: ../package.json from both
 * src/ and dist/, but found by walking so a build elsewhere (the tests build into a cache) works. */
function version(): string {
  const require = createRequire(import.meta.url);
  for (let dir = new URL(".", import.meta.url); ; dir = new URL("..", dir)) {
    try {
      const pkg = require(new URL("package.json", dir).pathname) as { name?: string; version: string };
      if (pkg.name === "@danolekh/cardstock-backgrounds") return pkg.version;
    } catch {
      // No package.json at this level; keep climbing.
    }
    if (dir.pathname === "/") return "unknown";
  }
}

const show = (path: string) => relative(process.cwd(), path) || path;
const kb = (bytes: number) => `${Math.round(bytes / 102.4) / 10} KB`;

function reportPresets(result: MergeResult & { path: string; created: boolean }, dryRun: boolean) {
  const verb = dryRun ? "would " : "";
  const parts = [
    result.added.length && `${verb}add ${result.added.join(", ")}`,
    result.replaced.length && `${verb}replace ${result.replaced.join(", ")}`,
    result.skipped.length && `kept ${result.skipped.join(", ")} (already there; --force replaces)`,
    result.outside.length && `left ${result.outside.join(", ")} (defined outside the markers)`,
  ].filter(Boolean);
  const file = `${show(result.path)}${result.created ? (dryRun ? " (would create)" : " (created)") : ""}`;
  console.log(`${file}: ${parts.length ? parts.join("; ") : "nothing to change"}`);
}

async function list(values: Record<string, unknown>) {
  const { manifest } = await loadManifest(values.manifest as string | undefined);
  if (values.json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  const rows = Object.entries(manifest.presets).map(([name, p]) => {
    const bytes = p.files.reduce((s, f) => s + f.bytes, 0);
    return [name, p.label, p.background.type, p.tags.join(" "), bytes ? kb(bytes) : ""];
  });
  const widths = rows[0]?.map((_, i) => Math.max(...rows.map((r) => r[i]!.length))) ?? [];
  for (const row of rows)
    console.log(
      row
        .map((c, i) => c.padEnd(widths[i]!))
        .join("  ")
        .trimEnd(),
    );
  console.log(
    `\n${rows.length} presets, ${manifest.license}. Add one with: cardstock-backgrounds add <name>`,
  );
}

async function add(names: string[], values: Record<string, unknown>) {
  const dryRun = Boolean(values["dry-run"]);
  const result = await addPresets(names, {
    all: values.all as boolean | undefined,
    manifest: values.manifest as string | undefined,
    remote: values.remote as boolean | undefined,
    dir: values.dir as string | undefined,
    base: values.base as string | undefined,
    out: values.out as string | undefined,
    json: values.json as boolean | undefined,
    force: values.force as boolean | undefined,
    dryRun,
  });
  for (const preset of result.presets) {
    const files = preset.files.map(
      (f) =>
        `${show(f.path)} ${f.status === "unchanged" ? "(unchanged)" : f.status === "would write" ? `(would write, ${kb(f.bytes)})` : kb(f.bytes)}`,
    );
    console.log(`${preset.name}: ${files.length ? files.join(", ") : preset.background.type}`);
  }
  reportPresets(result.presetsFile, dryRun);
}

function summary(r: BuildResult): string {
  const { tone, ink, color } = r.background;
  const contrast = r.contrast === null ? "contrast not measured" : `${r.contrast}:1`;
  return `${r.name}: color ${color}, tone ${tone}, ink ${ink} (${contrast}), ${r.files.map((f) => `${f.file} ${kb(f.bytes)}`).join(", ")}`;
}

async function build(images: string[], values: Record<string, unknown>) {
  if (!images.length)
    throw new UsageError("Name the images to build, e.g. `cardstock-backgrounds build art/ocean.jpg`.");
  if (values.name && images.length > 1) throw new UsageError("--name only works with a single image.");
  const tone = values.tone as string | undefined;
  if (tone !== undefined && tone !== "light" && tone !== "dark")
    throw new UsageError(`--tone should be light or dark, got "${tone}".`);
  const sizes = values.sizes
    ? parseSizes((values.sizes as string).split(",").map((s) => Number(s.trim())))
    : undefined;
  const quality = values.quality === undefined ? undefined : Number(values.quality);
  const dryRun = Boolean(values["dry-run"]);
  const options = {
    position: values.position as string | undefined,
    sizes,
    format: values.format as Format | undefined,
    quality,
    hash: values.hash as boolean | undefined,
    tone: tone as Tone | undefined,
    ink: values.ink as string | undefined,
    label: values.label as string | undefined,
    credit: values.credit as string | undefined,
    dir: values.dir as string | undefined,
    base: values.base as string | undefined,
    dryRun,
  };
  const json = values.json as boolean | undefined;
  const out = (values.out as string | undefined) ?? defaultOut(json);
  // Refuse before encoding anything, rather than write the files and then keep the old entry.
  if (!values.force) {
    const existing = (await readIfExists(out))?.toString("utf8");
    const keys = existing ? presetKeys(existing, json ? "json" : "ts") : [];
    const taken = images
      .map((i) => (values.name as string | undefined) ?? slug(i))
      .filter((n) => keys.includes(n));
    if (taken.length)
      throw new UsageError(
        `${show(out)} already has ${taken.join(", ")}. Pass --force to rebuild, or --name for a new key.`,
      );
  }
  const results: BuildResult[] = [];
  for (const image of images) {
    const result = await buildBackground(image, { ...options, name: values.name as string | undefined });
    results.push(result);
    console.log(summary(result));
    for (const warning of result.warnings) console.warn(`  warning: ${image} ${warning}`);
  }
  const merged = await writePresets(out, Object.fromEntries(results.map((r) => [r.name, r.background])), {
    json,
    force: values.force as boolean | undefined,
    dryRun,
  });
  reportPresets(merged, dryRun);
}

export async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    // node's own messages explain positionals at length; the flag and a guess are more use.
    const message = (error as Error).message;
    const unknown = /^Unknown option '(-{1,2})([^']+)'/.exec(message);
    const guess = unknown && closest(unknown[2]!, Object.keys(OPTIONS));
    console.error(
      `${unknown ? `Unknown option ${unknown[1]}${unknown[2]}.` : message}${guess ? ` Did you mean --${guess}?` : ""} Run with --help for usage.`,
    );
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.version) {
    console.log(version());
    return 0;
  }
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(HELP);
    return values.help ? 0 : 2;
  }
  if (!(COMMANDS as readonly string[]).includes(command)) {
    const guess = closest(command, COMMANDS);
    console.error(
      `Unknown command "${command}".${guess ? ` Did you mean "${guess}"?` : ""} Run with --help for usage.`,
    );
    return 2;
  }
  const cmd = command as (typeof COMMANDS)[number];
  const stray = (Object.keys(values) as Flag[]).filter((f) => !ALLOWED[cmd].includes(f));
  if (stray.length) {
    console.error(`${cmd} doesn't take ${stray.map((f) => `--${f}`).join(", ")}. Run with --help for usage.`);
    return 2;
  }
  if (cmd === "list" && rest.length) {
    console.error("list doesn't take names; add them with `add <name…>`.");
    return 2;
  }
  try {
    if (cmd === "list") await list(values);
    else if (cmd === "add") await add(rest, values);
    else await build(rest, values);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (process.env.DEBUG && error instanceof Error) console.error(error.stack);
    return error instanceof UsageError ? 2 : 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
