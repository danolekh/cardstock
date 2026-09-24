import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadManifest, ManifestError, presetBackground, validateManifest } from "../src/manifest.ts";
import { manifest, scratch } from "./helpers.ts";

describe("validateManifest", () => {
  it("accepts a good manifest", () => {
    const m = validateManifest(manifest());
    expect(Object.keys(m.presets)).toEqual(["holo", "noir", "ink"]);
    expect(m.presets.holo!.background).toEqual({
      type: "image",
      color: "#c7b5f4",
      tone: "light",
      ink: "#231a3d",
    });
  });

  it("accepts the published house manifest", async () => {
    const { manifest: house } = await loadManifest(
      new URL("../../../apps/docs/public/backgrounds/manifest.json", import.meta.url).pathname,
    );
    expect(Object.keys(house.presets).length).toBeGreaterThanOrEqual(10);
  });

  it.each([
    [
      "a colour that could escape the declaration",
      (m: any) => (m.presets.holo.background.color = "red; background: url(x)"),
    ],
    ["an ink that isn't a colour", (m: any) => (m.presets.holo.background.ink = "var(--x)")],
    ["a file name with a path", (m: any) => (m.presets.holo.files[0].file = "../../etc/passwd.webp")],
    ["a bad checksum", (m: any) => (m.presets.holo.files[0].sha256 = "abc")],
    ["an image without files", (m: any) => (m.presets.holo.files = [])],
    ["a gradient with files", (m: any) => (m.presets.ink.files = m.presets.noir.files)],
    ["a src in the background", (m: any) => (m.presets.holo.background.src = "https://x/y.webp")],
    ["an unknown type", (m: any) => (m.presets.ink.background.type = "conic")],
    ["a bad name", (m: any) => (m.presets["Bad Name"] = m.presets.ink)],
    ["another version", (m: any) => (m.version = 2)],
  ])("rejects %s", (_what, spoil) => {
    const m = manifest();
    spoil(m);
    expect(() => validateManifest(m)).toThrow(ManifestError);
  });

  it("lists every problem at once", () => {
    const m: any = manifest();
    m.version = 3;
    m.presets.holo.background.color = "nope(";
    m.presets.noir.files[0].bytes = -1;
    const error = (() => {
      try {
        validateManifest(m);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ManifestError);
    expect((error as ManifestError).problems).toHaveLength(3);
  });
});

describe("loadManifest", () => {
  it("loads from a path and resolves a relative base against it", async () => {
    const dir = await scratch();
    const path = join(dir, "manifest.json");
    await writeFile(path, JSON.stringify({ ...manifest(), base: "./files" }));
    const loaded = await loadManifest(path);
    expect(loaded.base).toBe(`file://${dir}/files/`);
  });

  it("fetches over https", async () => {
    const { vi } = await import("vitest");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(manifest())));
    try {
      const loaded = await loadManifest("https://art.example/backgrounds/manifest.json");
      expect(loaded.base).toBe("https://art.example/backgrounds/");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("says when it isn't JSON", async () => {
    const dir = await scratch();
    await writeFile(join(dir, "m.json"), "<html>");
    await expect(loadManifest(join(dir, "m.json"))).rejects.toThrow(/isn't JSON/);
  });
});

describe("presetBackground", () => {
  it("fills in the src and a srcSet from narrowest to widest", () => {
    expect(presetBackground(manifest().presets.holo!, "/backgrounds")).toEqual({
      type: "image",
      label: "Holo",
      src: "/backgrounds/holo.webp",
      srcSet: "/backgrounds/holo-860.webp 860w, /backgrounds/holo.webp 1720w",
      color: "#c7b5f4",
      tone: "light",
      ink: "#231a3d",
    });
    expect(presetBackground(manifest().presets.noir!, "https://cdn.example/bg/")).toMatchObject({
      src: "https://cdn.example/bg/noir.webp",
    });
    expect(presetBackground(manifest().presets.noir!, "")).not.toHaveProperty("srcSet");
  });
});
