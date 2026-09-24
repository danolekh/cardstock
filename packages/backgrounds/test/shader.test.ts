import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addPresets } from "../src/add.ts";
import { sha256 } from "../src/io.ts";
import { type Manifest, ManifestError, presetBackground, validateManifest } from "../src/manifest.ts";
import { scratch } from "./helpers.ts";

const BASE = "https://art.example/backgrounds/";
const poster = new TextEncoder().encode("silk poster");
const poster860 = new TextEncoder().encode("silk poster at 860");
const FILES: Record<string, Uint8Array> = { "silk-still.webp": poster, "silk-still-860.webp": poster860 };
const file = (name: string, width: number) => ({
  file: name,
  width,
  height: Math.round(width / 1.5926),
  bytes: FILES[name]!.byteLength,
  sha256: sha256(FILES[name]!),
});

const shaders = (): Manifest => ({
  version: 1,
  base: BASE,
  license: "MIT",
  presets: {
    silk: {
      label: "Silk",
      tags: ["animated", "dark"],
      background: {
        type: "shader",
        shader: "silk",
        params: { colors: ["#120c2c", "#b25cff"], turbulence: 0.6 },
        color: "#532d90",
        tone: "dark",
        ink: "#f5f3ff",
      },
      files: [file("silk-still.webp", 1720), file("silk-still-860.webp", 860)],
    },
    nebula: {
      label: "Nebula",
      tags: ["animated"],
      background: { type: "shader", shader: "nebula", color: "#101020" },
      files: [],
    },
  },
});

beforeEach(() => {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const bytes = FILES[String(input).replace(BASE, "")];
    return bytes ? new Response(bytes) : new Response("missing", { status: 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("shader presets", () => {
  it("validate, and fill in the poster from the files", () => {
    const m = validateManifest(shaders());
    expect(presetBackground(m.presets.silk!, "/backgrounds")).toEqual({
      type: "shader",
      label: "Silk",
      shader: "silk",
      params: { colors: ["#120c2c", "#b25cff"], turbulence: 0.6 },
      color: "#532d90",
      tone: "dark",
      ink: "#f5f3ff",
      poster: "/backgrounds/silk-still.webp",
      posterSrcSet: "/backgrounds/silk-still-860.webp 860w, /backgrounds/silk-still.webp 1720w",
    });
    expect(presetBackground(m.presets.nebula!, "/backgrounds")).toEqual({
      type: "shader",
      label: "Nebula",
      shader: "nebula",
      color: "#101020",
    });
  });

  it("refuse a poster in the data, and bad params", () => {
    const m = shaders();
    (m.presets.silk!.background as Record<string, unknown>).poster = "/x.webp";
    (m.presets.nebula!.background as Record<string, unknown>).params = { x: "url(evil)" };
    let error: unknown;
    try {
      validateManifest(m);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ManifestError);
    expect((error as ManifestError).problems).toEqual([
      expect.stringContaining("leave out src, srcSet, poster and posterSrcSet"),
      expect.stringContaining("presets.nebula.background isn't a valid card background"),
    ]);
  });

  it("add downloads the poster, and warns about a shader this cardstock lacks", async () => {
    const cwd = await scratch();
    await mkdir(join(cwd, "src"));
    const loaded = { manifest: validateManifest(shaders()), base: BASE, source: `${BASE}manifest.json` };
    const result = await addPresets(["silk", "nebula"], { manifest: loaded, cwd });
    expect(await readdir(join(cwd, "public/backgrounds"))).toEqual([
      "silk-still-860.webp",
      "silk-still.webp",
    ]);
    const text = await readFile(join(cwd, "src/lib/card-backgrounds.ts"), "utf8");
    expect(text).toContain('"poster":"/backgrounds/silk-still.webp"');
    expect(result.warnings).toEqual([expect.stringContaining('"nebula" shader')]);
  });
});
