import { readdir } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { buildBackground, parsePosition, titleCase } from "../src/build.ts";
import { luminance, hexToRgb } from "../src/color.ts";
import { scratch } from "./helpers.ts";

/** A solid PNG. */
const solid = (color: string, width = 400, height = 300) =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();

/** A tall PNG: red on top, blue below, so the crop shows which part was kept. */
async function tall(): Promise<Buffer> {
  const [w, h] = [300, 800];
  const data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set(y < h / 2 ? [230, 30, 30] : [30, 30, 230], (y * w + x) * 3);
  return sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

/** Black with white stripes over a fifth of it: dark on average, bright where the text may sit. */
async function striped(): Promise<Buffer> {
  const [w, h] = [400, 250];
  const data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (x % 50 < 10) data.fill(255, (y * w + x) * 3, (y * w + x) * 3 + 3);
  return sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

const size = async (path: string) => {
  const { width, height, format } = await sharp(path).metadata();
  return [width, height, format];
};

describe("buildBackground", () => {
  it("encodes the card's sizes exactly, and describes a light image", async () => {
    const cwd = await scratch();
    const r = await buildBackground(await solid("#f0ead8"), { name: "sand", cwd });
    expect(r.files.map((f) => f.file)).toEqual(["sand.webp", "sand-860.webp"]);
    expect(await size(r.files[0]!.path)).toEqual([1720, 1080, "webp"]);
    expect(await size(r.files[1]!.path)).toEqual([860, 540, "webp"]);
    expect(r.background).toMatchObject({
      type: "image",
      label: "Sand",
      src: "/backgrounds/sand.webp",
      srcSet: "/backgrounds/sand-860.webp 860w, /backgrounds/sand.webp 1720w",
      color: "#f0ead8",
      tone: "light",
    });
    expect(luminance(hexToRgb(r.background.ink!)!)).toBeLessThan(0.05);
    expect(r.contrast).toBeGreaterThan(10);
    expect(r.warnings).toEqual(["is 400×300, so the 1720px file is upscaled"]);
  });

  it("gives a dark image a light ink", async () => {
    const cwd = await scratch();
    const r = await buildBackground(await solid("#123a7a"), { name: "deep", cwd });
    expect(r.background.tone).toBe("dark");
    expect(luminance(hexToRgb(r.background.ink!)!)).toBeGreaterThan(0.85);
  });

  it("keeps the part --position asks for", async () => {
    const image = await tall();
    const top = await buildBackground(image, { name: "top", position: "top", cwd: await scratch() });
    const centre = await buildBackground(image, { name: "mid", cwd: await scratch() });
    const bottom = await buildBackground(image, { name: "bot", position: "50% 100%", cwd: await scratch() });
    expect(hexToRgb(top.mean)![0]).toBeGreaterThan(200);
    expect(hexToRgb(bottom.mean)![2]).toBeGreaterThan(200);
    expect(top.files[0]!.sha256).not.toBe(centre.files[0]!.sha256);
    expect(top.background.position).toBe("50% 0%");
    expect(centre.background).not.toHaveProperty("position");
  });

  it("names files by content with --hash, the same on every run", async () => {
    const image = await solid("#445566");
    const a = await buildBackground(image, { name: "slate", hash: true, cwd: await scratch() });
    const b = await buildBackground(image, { name: "slate", hash: true, cwd: await scratch() });
    expect(a.files[0]!.file).toMatch(/^slate\.[0-9a-f]{8}\.webp$/);
    expect(a.files[1]!.file).toMatch(/^slate-860\.[0-9a-f]{8}\.webp$/);
    expect(a.files.map((f) => f.file)).toEqual(b.files.map((f) => f.file));
    expect(a.background.src).toBe(`/backgrounds/${a.files[0]!.file}`);
  });

  it("encodes AVIF, other sizes, and into --dir with a --base", async () => {
    const cwd = await scratch();
    const r = await buildBackground(await solid("#445566"), {
      name: "slate",
      format: "avif",
      sizes: [1200, 600, 300],
      dir: "static/bg",
      base: "https://cdn.example/bg",
      cwd,
    });
    expect(await readdir(join(cwd, "static/bg"))).toEqual(["slate-300.avif", "slate-600.avif", "slate.avif"]);
    expect(await size(r.files[0]!.path)).toEqual([1200, 753, "heif"]);
    expect(r.background.src).toBe("https://cdn.example/bg/slate.avif");
  });

  it("warns when the ink loses the worst areas", async () => {
    const r = await buildBackground(await striped(), { name: "stripes", cwd: await scratch() });
    expect(r.background.tone).toBe("dark");
    expect(r.contrast).toBeLessThan(4.5);
    expect(r.warnings.join()).toMatch(/contrast/);
  });

  it("takes overrides, and names a file after itself", async () => {
    const cwd = await scratch();
    await sharp(await solid("#f0ead8")).toFile(join(cwd, "My Ocean.png"));
    const r = await buildBackground("My Ocean.png", {
      cwd,
      tone: "dark",
      ink: "#ff0000",
      label: "Ocean",
      credit: "Photo by Someone",
      dryRun: true,
    });
    expect(r.name).toBe("my-ocean");
    expect(r.background).toMatchObject({
      tone: "dark",
      ink: "#ff0000",
      label: "Ocean",
      credit: "Photo by Someone",
    });
    expect(r.files[0]!.status).toBe("would write");
    expect(await readdir(cwd)).toEqual(["My Ocean.png"]);
  });

  it("refuses bad options before doing any work", async () => {
    const cwd = await scratch();
    const image = await solid("#fff");
    await expect(buildBackground(image, { cwd })).rejects.toThrow(/--name/);
    await expect(buildBackground(image, { name: "x", ink: "url(x)", cwd })).rejects.toThrow(/--ink/);
    await expect(buildBackground(image, { name: "x", position: "sideways", cwd })).rejects.toThrow(
      /--position/,
    );
    await expect(buildBackground("missing.png", { cwd })).rejects.toThrow(/No file/);
    expect(await readdir(cwd)).toEqual([]);
  });
});

describe("helpers", () => {
  it("reads positions", () => {
    expect(parsePosition("centre")).toEqual({ kind: "focal", x: 0.5, y: 0.5 });
    expect(parsePosition("left top")).toEqual({ kind: "focal", x: 0, y: 0 });
    expect(parsePosition("30% 60%")).toEqual({ kind: "focal", x: 0.3, y: 0.6 });
    expect(parsePosition("attention")).toEqual({ kind: "strategy", strategy: "attention" });
  });

  it("title-cases names", () => {
    expect(titleCase("guilloche-sand")).toBe("Guilloche Sand");
  });
});
