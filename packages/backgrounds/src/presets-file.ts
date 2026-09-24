/* The presets file: the app's own list of card backgrounds, which `add` and `build` keep up to
 * date. It's plain TypeScript the app imports and owns: the tool only rewrites entries between
 * two marker comments, matched by key, and leaves every other byte alone. Entries are written one
 * JSON line each, but the reader doesn't rely on that, so a formatter reflowing them, or a hand
 * edit to a value, survives the next run. With `--json` the file is a plain JSON object instead,
 * for apps that load their presets at runtime or from another language. */

import type { CardBackground } from "@danolekh/cardstock/background";

import { readIfExists, writeAtomic } from "./io.ts";

/** A background to write under a name. */
export type PresetEntries = Record<string, CardBackground>;

export interface MergeOptions {
  /** Replace entries that already exist, instead of leaving them. */
  force?: boolean;
}

export interface MergeResult {
  text: string;
  added: string[];
  replaced: string[];
  /** Already there, and kept because `force` was off. */
  skipped: string[];
  /** Defined outside the markers, where the tool doesn't write; kept even with `force`. */
  outside: string[];
}

export const START = "// cardstock-backgrounds:start";
export const END = "// cardstock-backgrounds:end";

export const TEMPLATE = `// Card backgrounds, managed by @danolekh/cardstock-backgrounds. Lines between the markers are
// rewritten by key on \`add\` and \`build\`; edit values freely, or add your own entries outside them.
import type { CardBackground } from "@danolekh/cardstock";

export const CARD_BACKGROUNDS = {
  ${START}
  ${END}
} as const satisfies Record<string, CardBackground & { label: string }>;

export type CardBackgroundName = keyof typeof CARD_BACKGROUNDS;
`;

interface Entry {
  key: string;
  /** Offsets in the region: where the key starts and where the value ends. */
  start: number;
  end: number;
  /** Whether a comma follows the value. */
  comma: boolean;
}

/** Skips a string, a comment or a single character starting at `i`; returns the next index. */
function skip(text: string, i: number): number {
  const c = text[i];
  if (c === '"' || c === "'" || c === "`") {
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === "\\") j++;
      else if (text[j] === c) return j + 1;
    }
    return text.length;
  }
  if (c === "/" && text[i + 1] === "/") {
    const nl = text.indexOf("\n", i);
    return nl === -1 ? text.length : nl;
  }
  if (c === "/" && text[i + 1] === "*") {
    const close = text.indexOf("*/", i + 2);
    return close === -1 ? text.length : close + 2;
  }
  return i + 1;
}

/** The object members between the markers: `key: value` pairs, whatever their formatting. */
function entriesOf(region: string): Entry[] {
  const entries: Entry[] = [];
  let i = 0;
  while (i < region.length) {
    const c = region[i]!;
    if (/[\s,]/.test(c)) {
      i++;
      continue;
    }
    if (c === "/" && (region[i + 1] === "/" || region[i + 1] === "*")) {
      i = skip(region, i);
      continue;
    }
    const start = i;
    // The key: a quoted string or a bare identifier, up to the colon.
    let key: string;
    if (c === '"' || c === "'") {
      i = skip(region, i);
      const raw = region.slice(start + 1, i - 1);
      key = raw.replace(/\\(.)/g, "$1");
    } else {
      const m = /^[\w$-]+/.exec(region.slice(i));
      if (!m) throw new Error(`Can't read the entry at "${region.slice(i, i + 30)}…".`);
      key = m[0];
      i += m[0].length;
    }
    // The value: everything up to the next comma outside brackets, strings and comments.
    let depth = 0;
    let end = i;
    while (i < region.length) {
      const ch = region[i]!;
      if (depth === 0 && ch === ",") break;
      if ("{[(".includes(ch)) depth++;
      else if ("}])".includes(ch)) depth--;
      const next = skip(region, i);
      const isComment = ch === "/" && (region[i + 1] === "/" || region[i + 1] === "*");
      if (!isComment && !/\s/.test(ch)) end = next;
      i = next;
    }
    entries.push({ key, start, end, comma: region[i] === "," });
    i++;
  }
  return entries;
}

const line = (key: string, value: CardBackground) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`;

function markerLines(text: string): { start: number; end: number; lines: string[] } {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === START);
  const end = lines.findIndex((l, i) => i > start && l.trim() === END);
  if (start === -1 || end === -1)
    throw new Error(
      `The presets file has no "${START}" … "${END}" markers. Add them inside the object the tool should write to, or choose another file with --out.`,
    );
  return { start, end, lines };
}

/** The keys a presets file defines between its markers (TypeScript) or at its top level (JSON). */
export function presetKeys(text: string, format: "ts" | "json" = "ts"): string[] {
  if (format === "json") return Object.keys(parseJsonObject(text));
  const { start, end, lines } = markerLines(text);
  return entriesOf(lines.slice(start + 1, end).join("\n")).map((e) => e.key);
}

/** Merges `entries` into a TypeScript presets file (or a new one when `existing` is null). */
export function mergePresetsTs(
  existing: string | null,
  entries: PresetEntries,
  options: MergeOptions = {},
): MergeResult {
  const text = existing ?? TEMPLATE;
  const { start, end, lines } = markerLines(text);
  const indent = /^\s*/.exec(lines[start]!)![0];
  const before = lines.slice(0, start + 1);
  const after = lines.slice(end);
  const outsideText = [...before, ...after].join("\n");
  let region = lines.slice(start + 1, end).join("\n");
  const found = entriesOf(region);
  const result: MergeResult = { text: "", added: [], replaced: [], skipped: [], outside: [] };

  const edits: { entry: Entry; value: CardBackground }[] = [];
  const append: string[] = [];
  for (const [key, value] of Object.entries(entries)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
    if (new RegExp(`^\\s*["']?${escaped}["']?\\s*:`, "m").test(outsideText)) {
      result.outside.push(key);
      continue;
    }
    const entry = found.find((e) => e.key === key);
    if (!entry) {
      append.push(`${indent}${line(key, value)},`);
      result.added.push(key);
    } else if (options.force) {
      edits.push({ entry, value });
      result.replaced.push(key);
    } else result.skipped.push(key);
  }

  // Appending after an entry that has no trailing comma would run the two together.
  const last = found.at(-1);
  if (append.length && last && !last.comma) region = `${region.slice(0, last.end)},${region.slice(last.end)}`;
  // Replace from the end, so earlier offsets stay good.
  for (const { entry, value } of edits.sort((a, b) => b.entry.start - a.entry.start))
    region = region.slice(0, entry.start) + line(entry.key, value) + region.slice(entry.end);

  const middle = region.length ? region.split("\n") : [];
  result.text = [...before, ...middle, ...append, ...after].join("\n");
  return result;
}

function parseJsonObject(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`The presets file isn't JSON: ${(error as Error).message}`, { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("The presets file should hold a JSON object of backgrounds by name.");
  return parsed as Record<string, unknown>;
}

/** Merges `entries` into a JSON presets file: an object of backgrounds by name, one per line. */
export function mergePresetsJson(
  existing: string | null,
  entries: PresetEntries,
  options: MergeOptions = {},
): MergeResult {
  const current = existing === null || !existing.trim() ? {} : parseJsonObject(existing);
  const result: MergeResult = { text: "", added: [], replaced: [], skipped: [], outside: [] };
  for (const [key, value] of Object.entries(entries)) {
    if (!(key in current)) result.added.push(key);
    else if (options.force) result.replaced.push(key);
    else {
      result.skipped.push(key);
      continue;
    }
    current[key] = value;
  }
  const body = Object.entries(current).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  result.text = body.length ? `{\n${body.join(",\n")}\n}\n` : "{}\n";
  return result;
}

export interface WritePresetsOptions extends MergeOptions {
  /** Write a JSON object file rather than TypeScript. */
  json?: boolean;
  /** Work out the result without writing anything. */
  dryRun?: boolean;
}

/** Reads the presets file at `path` (if any), merges `entries` in and writes it back atomically.
 * Nothing is written when nothing changed. */
export async function writePresets(
  path: string,
  entries: PresetEntries,
  options: WritePresetsOptions = {},
): Promise<MergeResult & { path: string; created: boolean }> {
  const existing = (await readIfExists(path))?.toString("utf8") ?? null;
  const merge = options.json ? mergePresetsJson : mergePresetsTs;
  const result = merge(existing, entries, options);
  if (!options.dryRun && result.text !== existing) await writeAtomic(path, result.text);
  return { ...result, path, created: existing === null };
}
