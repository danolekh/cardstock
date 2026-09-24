/* Writes public/backgrounds/manifest.json: the catalogue @danolekh/cardstock-backgrounds reads to
 * list the house backgrounds and download them. It's made from the preset data (the backgrounds as
 * the docs use them) and the encoded files themselves, so each file's size, pixel size and SHA-256
 * are the real ones; rerun it after rendering the artwork again.
 *
 *   node scripts/manifest.ts
 *
 * The result is checked with the package's own validator before it's written, so a preset the CLI
 * would refuse never gets published. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const OUT = new URL("../public/backgrounds/", import.meta.url);
const BASE = "https://cardstock.danolekh.com/backgrounds/";

// Imported by computed paths: the docs type-check doesn't allow `.ts` import paths, and the preset
// data is moving from the registry into src/lib.
const load = (path: string) => import(new URL(path, import.meta.url).href);
const DATA = ["../src/lib/backgrounds.ts", "../registry/cardstock/backgrounds.ts"].find((p) =>
  existsSync(new URL(p, import.meta.url)),
);
if (!DATA)
  throw new Error("No preset data found in src/lib/backgrounds.ts or registry/cardstock/backgrounds.ts.");
const data: Record<string, unknown> = await load(DATA);
const presets = (data.BACKGROUNDS ?? Object.values(data).find((v) => typeof v === "object")) as Record<
  string,
  Record<string, unknown> & { type: string; label: string }
>;
const { validateManifest } = await load("../../../packages/backgrounds/src/manifest.ts");
const { backgroundTone } = await import("@danolekh/cardstock/background");

/** Pixel size from a WebP header: lossy (VP8), lossless (VP8L) or extended (VP8X). */
function webpSize(bytes: Buffer): [number, number] {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")
    throw new Error("Not a WebP file.");
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") {
    const b = bytes.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8X") return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  throw new Error(`Unknown WebP chunk "${chunk}".`);
}

// What each piece of artwork is, beyond light or dark, for filtering in a picker or `list`.
const TAGS: Record<string, string[]> = {
  guilloche: ["pattern", "engraved"],
  "guilloche-sand": ["pattern", "engraved"],
  holo: ["foil", "iridescent"],
  aurora: ["mesh", "gradient"],
  dusk: ["mesh", "gradient"],
  topo: ["pattern", "lines"],
  steel: ["metal", "brushed"],
  linen: ["paper", "texture"],
  tide: ["pattern", "waves"],
  noir: ["pattern", "grid"],
  singularity: ["space", "glow"],
  silk: ["fabric", "gradient"],
  mesh: ["mesh", "gradient"],
  grain: ["gradient", "texture"],
  "liquid-metal": ["metal", "chrome"],
  "holo-foil": ["foil", "iridescent"],
  "flow-dots": ["pattern", "dots"],
  "guilloche-live": ["pattern", "engraved"],
};

/** The files a preset names, from its srcSet (or its src alone), or a shader's poster, as bare
 * file names. */
function filesOf(bg: Record<string, unknown>): string[] {
  const src = bg.type === "shader" ? bg.poster : bg.src;
  const srcSet = bg.type === "shader" ? bg.posterSrcSet : bg.srcSet;
  if (typeof src !== "string") return [];
  const set = typeof srcSet === "string" ? srcSet.split(",").map((c) => c.trim().split(/\s+/)[0]!) : [];
  return [...new Set([src, ...set].map((url) => basename(new URL(url, BASE).pathname)))];
}

const manifest = {
  version: 1,
  base: BASE,
  license: "MIT",
  presets: Object.fromEntries(
    Object.entries(presets).map(([name, bg]) => {
      const {
        label,
        src: _src,
        srcSet: _srcSet,
        poster: _poster,
        posterSrcSet: _posterSrcSet,
        ...background
      } = bg;
      const tone = backgroundTone(bg as never);
      const files =
        bg.type === "image" || bg.type === "shader"
          ? filesOf(bg)
              .map((file) => {
                const bytes = readFileSync(new URL(file, OUT));
                const [width, height] = webpSize(bytes);
                const sha256 = createHash("sha256").update(bytes).digest("hex");
                return { file, width, height, bytes: bytes.byteLength, sha256 };
              })
              .sort((a, b) => b.width - a.width)
          : [];
      const kind = bg.type === "image" ? [] : bg.type === "shader" ? ["animated"] : ["gradient"];
      const tags = [...(TAGS[name] ?? []), ...kind, tone];
      return [name, { label, tags: [...new Set(tags)], background, files }];
    }),
  ),
};

/** JSON as the repo's formatter writes it: arrays of plain values on one line, so a rerun leaves
 * `pnpm format` clean. */
const json = (value: unknown) =>
  JSON.stringify(value, null, 2).replace(/\[\s*([^[\]{}]*?)\s*\]/g, (_, items: string) =>
    items ? `[${items.split(/,\s*/).join(", ")}]` : "[]",
  );

validateManifest(manifest, "manifest.json");
writeFileSync(new URL("manifest.json", OUT), `${json(manifest)}\n`);
console.log(`backgrounds/manifest.json: ${Object.keys(manifest.presets).length} presets`);
