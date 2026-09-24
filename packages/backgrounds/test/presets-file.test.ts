import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CardBackground } from "@danolekh/cardstock/background";
import { describe, expect, it } from "vitest";

import {
  END,
  mergePresetsJson,
  mergePresetsTs,
  presetKeys,
  START,
  TEMPLATE,
  writePresets,
} from "../src/presets-file.ts";
import { scratch } from "./helpers.ts";

const holo: CardBackground = { type: "image", label: "Holo", src: "/bg/holo.webp", color: "#c7b5f4" };
const noir: CardBackground = { type: "image", label: "Noir", src: "/bg/noir.webp", color: "#111218" };
const ink: CardBackground = { type: "solid", label: "Ink", color: "#171614" };

describe("the TypeScript presets file", () => {
  it("is created from the template with one JSON line per key", () => {
    const { text, added } = mergePresetsTs(null, { holo, noir });
    expect(added).toEqual(["holo", "noir"]);
    expect(text.startsWith("// Card backgrounds, managed by @danolekh/cardstock-backgrounds.")).toBe(true);
    expect(text).toContain(
      `  ${START}\n  "holo": ${JSON.stringify(holo)},\n  "noir": ${JSON.stringify(noir)},\n  ${END}\n`,
    );
    expect(text).toContain("export type CardBackgroundName = keyof typeof CARD_BACKGROUNDS;");
    expect(presetKeys(text)).toEqual(["holo", "noir"]);
  });

  it("merges by key, keeping what's there unless forced", () => {
    const first = mergePresetsTs(null, { holo }).text;
    const changed = { ...holo, color: "#000000" };
    const kept = mergePresetsTs(first, { holo: changed, noir });
    expect(kept.added).toEqual(["noir"]);
    expect(kept.skipped).toEqual(["holo"]);
    expect(kept.text).toContain('"color":"#c7b5f4"');

    const forced = mergePresetsTs(kept.text, { holo: changed }, { force: true });
    expect(forced.replaced).toEqual(["holo"]);
    expect(forced.text).toContain('"color":"#000000"');
    expect(presetKeys(forced.text)).toEqual(["holo", "noir"]);
  });

  it("leaves every line outside the markers byte for byte", () => {
    const custom = TEMPLATE.replace(
      "export const CARD_BACKGROUNDS = {\n",
      "// my own comment\nexport const CARD_BACKGROUNDS = {\n  plain: { type: 'solid', color: \"#fff\", label: 'Plain' },\n",
    ).replace("export type", "// trailing note\nexport type");
    const merged = mergePresetsTs(custom, { holo, noir }).text;
    const outside = (t: string) => {
      const lines = t.split("\n");
      return [
        ...lines.slice(0, lines.findIndex((l) => l.includes(START)) + 1),
        ...lines.slice(lines.findIndex((l) => l.includes(END))),
      ];
    };
    expect(outside(merged)).toEqual(outside(custom));
  });

  it("won't define a key that's already defined outside the markers", () => {
    const custom = TEMPLATE.replace(
      "export const CARD_BACKGROUNDS = {\n",
      "export const CARD_BACKGROUNDS = {\n  holo: { type: 'solid', color: '#fff', label: 'Mine' },\n",
    );
    const result = mergePresetsTs(custom, { holo }, { force: true });
    expect(result.outside).toEqual(["holo"]);
    expect(result.text).toBe(custom);
  });

  it("survives a formatter reflowing the entries", () => {
    const reflowed = TEMPLATE.replace(
      `  ${START}\n`,
      `  ${START}\n  holo: {\n    type: "image",\n    label: "Holo, reflowed",\n    src: "/bg/holo.webp",\n    color: "#c7b5f4", // a note\n  },\n  'noir': { type: "image", label: "Noir", src: "/bg/noir.webp", color: "#111" }\n`,
    );
    expect(presetKeys(reflowed)).toEqual(["holo", "noir"]);
    const { text, skipped, added, replaced } = mergePresetsTs(reflowed, { holo, noir, ink }, { force: true });
    expect([replaced, skipped, added]).toEqual([["holo", "noir"], [], ["ink"]]);
    expect(presetKeys(text)).toEqual(["holo", "noir", "ink"]);
    // The missing comma after noir was added before appending ink.
    expect(text).toContain(`"noir": ${JSON.stringify(noir)},\n  "ink": `);
  });

  it("needs its markers", () => {
    expect(() => mergePresetsTs("export const X = {};\n", { holo })).toThrow(/markers/);
  });
});

describe("the JSON presets file", () => {
  it("is created, merged and forced by key", () => {
    const first = mergePresetsJson(null, { holo });
    expect(JSON.parse(first.text)).toEqual({ holo });
    const second = mergePresetsJson(first.text, { holo: noir, ink });
    expect(second.skipped).toEqual(["holo"]);
    expect(JSON.parse(second.text)).toEqual({ holo, ink });
    const third = mergePresetsJson(second.text, { holo: noir }, { force: true });
    expect(JSON.parse(third.text)).toEqual({ holo: noir, ink });
    expect(third.text.split("\n")).toHaveLength(5);
  });

  it("refuses a file that isn't an object", () => {
    expect(() => mergePresetsJson("[1]", { holo })).toThrow(/object/);
  });
});

describe("writePresets", () => {
  it("writes, and doesn't touch a file that wouldn't change", async () => {
    const dir = await scratch();
    const path = join(dir, "src/lib/card-backgrounds.ts");
    const created = await writePresets(path, { holo });
    expect(created.created).toBe(true);
    const text = await readFile(path, "utf8");
    await writeFile(path, text);
    const again = await writePresets(path, { holo });
    expect(again.skipped).toEqual(["holo"]);
    expect(await readFile(path, "utf8")).toBe(text);
  });

  it("writes nothing on a dry run", async () => {
    const dir = await scratch();
    const path = join(dir, "presets.json");
    const result = await writePresets(path, { holo }, { json: true, dryRun: true });
    expect(result.added).toEqual(["holo"]);
    await expect(readFile(path)).rejects.toThrow(/ENOENT/);
  });
});
