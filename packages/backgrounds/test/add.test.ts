import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addPresets } from "../src/add.ts";
import { UsageError } from "../src/errors.ts";
import { FILES, manifest, scratch } from "./helpers.ts";

const MANIFEST = "https://art.example/backgrounds/manifest.json";
let requests: string[];

/** A fake host serving the fixture manifest and files; `tamper` corrupts one file. */
function serve(tamper?: string) {
  requests = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    requests.push(url);
    if (url === MANIFEST) return new Response(JSON.stringify(manifest()));
    const name = url.replace("https://art.example/backgrounds/", "");
    const bytes = FILES[name];
    if (!bytes) return new Response("missing", { status: 404, statusText: "Not Found" });
    return new Response(name === tamper ? new TextEncoder().encode("tampered!!!!") : bytes);
  });
}

beforeEach(() => serve());
afterEach(() => vi.unstubAllGlobals());

describe("addPresets", () => {
  it("downloads, verifies and records presets", async () => {
    const cwd = await scratch();
    await mkdir(join(cwd, "src"));
    const result = await addPresets(["holo", "ink"], { manifest: MANIFEST, cwd });
    expect(await readFile(join(cwd, "public/backgrounds/holo.webp"))).toEqual(
      Buffer.from(FILES["holo.webp"]!),
    );
    expect(await readdir(join(cwd, "public/backgrounds"))).toEqual(["holo-860.webp", "holo.webp"]);
    const text = await readFile(join(cwd, "src/lib/card-backgrounds.ts"), "utf8");
    expect(text).toContain(
      '"holo": {"type":"image","label":"Holo","src":"/backgrounds/holo.webp","srcSet":"/backgrounds/holo-860.webp 860w, /backgrounds/holo.webp 1720w","color":"#c7b5f4","tone":"light","ink":"#231a3d"},',
    );
    expect(text).toContain('"ink": {"type":"linear","label":"Ink"');
    expect(result.presetsFile.added).toEqual(["holo", "ink"]);

    // A second run finds the files already there and downloads nothing.
    requests = [];
    const again = await addPresets(["holo"], { manifest: MANIFEST, cwd });
    expect(again.presets[0]!.files.map((f) => f.status)).toEqual(["unchanged", "unchanged"]);
    expect(requests).toEqual([MANIFEST]);
  });

  it("uses --dir, --base, --out and --json", async () => {
    const cwd = await scratch();
    await addPresets(["noir"], {
      manifest: MANIFEST,
      cwd,
      dir: "static/cards",
      base: "https://cdn.example/cards/",
      out: "presets.json",
      json: true,
    });
    expect(await readdir(join(cwd, "static/cards"))).toEqual(["noir.webp"]);
    expect(JSON.parse(await readFile(join(cwd, "presets.json"), "utf8"))).toEqual({
      noir: {
        type: "image",
        label: "Noir",
        src: "https://cdn.example/cards/noir.webp",
        color: "#111218",
        tone: "dark",
        ink: "#e8e9f0",
      },
    });
  });

  it("points at the host with --remote and downloads nothing", async () => {
    const cwd = await scratch();
    const result = await addPresets(["holo"], { manifest: MANIFEST, cwd, remote: true });
    expect(result.presets[0]!.background).toHaveProperty("src", "https://art.example/backgrounds/holo.webp");
    expect(requests).toEqual([MANIFEST]);
    await expect(readdir(join(cwd, "public"))).rejects.toThrow(/ENOENT/);
  });

  it("writes nothing on a dry run", async () => {
    const cwd = await scratch();
    const result = await addPresets([], { all: true, manifest: MANIFEST, cwd, dryRun: true });
    expect(result.presets.map((p) => p.name)).toEqual(["holo", "noir", "ink"]);
    expect(result.presets[0]!.files[0]!.status).toBe("would write");
    expect(await readdir(cwd)).toEqual([]);
  });

  it("aborts on a checksum mismatch and leaves no file behind", async () => {
    serve("holo-860.webp");
    const cwd = await scratch();
    await expect(addPresets(["noir", "holo"], { manifest: MANIFEST, cwd })).rejects.toThrow(
      /doesn't match the manifest/,
    );
    // Not even noir, which downloaded fine, nor a temporary file.
    expect(await readdir(cwd)).toEqual([]);
  });

  it("won't overwrite a different file without --force", async () => {
    const cwd = await scratch();
    await mkdir(join(cwd, "public/backgrounds"), { recursive: true });
    await writeFile(join(cwd, "public/backgrounds/noir.webp"), "mine");
    await expect(addPresets(["noir"], { manifest: MANIFEST, cwd })).rejects.toThrow(/--force/);
    await addPresets(["noir"], { manifest: MANIFEST, cwd, force: true });
    expect(await readFile(join(cwd, "public/backgrounds/noir.webp"))).toEqual(
      Buffer.from(FILES["noir.webp"]!),
    );
  });

  it("suggests the closest name for an unknown one", async () => {
    const cwd = await scratch();
    const error = await addPresets(["hollo"], { manifest: MANIFEST, cwd }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsageError);
    expect((error as Error).message).toMatch(/No preset called "hollo"; did you mean "holo"\?/);
    expect(await readdir(cwd)).toEqual([]);
  });

  it("rejects a base the card wouldn't accept", async () => {
    const cwd = await scratch();
    await expect(
      addPresets(["holo"], { manifest: MANIFEST, cwd, base: "http://insecure.example" }),
    ).rejects.toThrow(/--base/);
  });
});
