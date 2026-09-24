import { describe, expect, it } from "vitest";

import {
  backgroundInk,
  backgroundStyle,
  backgroundTone,
  type CardBackground,
  frostBase,
  parseCardBackground,
  shaderBackground,
} from "./background";

const ink: CardBackground = {
  type: "linear",
  stops: [
    ["#34322d", 0],
    ["#080807", 1],
  ],
};
const holo: CardBackground = {
  type: "image",
  src: "https://cardstock.danolekh.com/backgrounds/holo.webp",
  srcSet: "/backgrounds/holo-860.webp 860w, /backgrounds/holo.webp 1720w",
  color: "#6d5a8f",
  tone: "dark",
};

describe("parseCardBackground", () => {
  it("accepts each type and round-trips through JSON", () => {
    const all: CardBackground[] = [
      { type: "solid", color: "rgb(20 20 20)" },
      ink,
      {
        type: "radial",
        at: [0.2, 0.8],
        stops: [
          ["oklch(70% 0.1 200)", 0],
          ["#000", 1],
        ],
      },
      holo,
    ];
    for (const bg of all) expect(parseCardBackground(JSON.parse(JSON.stringify(bg)))).toEqual(bg);
  });

  it("drops unknown keys", () => {
    expect(parseCardBackground({ type: "solid", color: "#fff", extra: 1 })).toEqual({
      type: "solid",
      color: "#fff",
    });
  });

  it("rejects colours that aren't plain colours", () => {
    for (const color of ["url(https://x.test/a.png)", "var(--x)", "red; background: blue", "#fff)"])
      expect(parseCardBackground({ type: "solid", color })).toBeNull();
  });

  it("rejects unsafe or insecure image URLs", () => {
    for (const src of [
      "javascript:alert(1)",
      "http://x.test/a.png",
      "//x.test/a.png",
      "data:text/html,hi",
      "/a b.png",
    ])
      expect(parseCardBackground({ type: "image", src, color: "#000" })).toBeNull();
    expect(parseCardBackground({ ...holo, srcSet: "javascript:x 1x" })).toBeNull();
  });

  it("rejects bad stops, angles, tones and unknown types", () => {
    expect(parseCardBackground({ type: "linear", stops: [["#000", 0]] })).toBeNull();
    expect(
      parseCardBackground({
        type: "linear",
        stops: [
          ["#000", 0],
          ["#fff", 2],
        ],
      }),
    ).toBeNull();
    expect(parseCardBackground({ ...ink, angle: Number.NaN })).toBeNull();
    expect(parseCardBackground({ ...ink, tone: "dim" })).toBeNull();
    expect(parseCardBackground({ type: "mesh" })).toBeNull();
    expect(parseCardBackground(null)).toBeNull();
    expect(parseCardBackground("ink")).toBeNull();
  });
});

describe("shader backgrounds", () => {
  const silk = shaderBackground("silk", {
    color: "#1b1530",
    poster: "/backgrounds/silk.webp",
    posterSrcSet: "/backgrounds/silk-860.webp 860w, /backgrounds/silk.webp 1720w",
    params: { colors: ["#7c5cff", "rgb(255, 122, 182)"], turbulence: 0.6 },
    speed: 0.8,
    tone: "dark",
  });

  it("builds data that parses and round-trips through JSON", () => {
    expect(silk).toMatchObject({ type: "shader", shader: "silk" });
    expect(parseCardBackground(JSON.parse(JSON.stringify(silk)))).toEqual(silk);
    expect(parseCardBackground({ type: "shader", shader: "acme/tide", color: "#000" })).toEqual({
      type: "shader",
      shader: "acme/tide",
      color: "#000",
    });
  });

  it("rejects bad ids, params, speeds and posters", () => {
    const bad: Record<string, unknown>[] = [
      { shader: "Silk" },
      { shader: "../silk" },
      { shader: "a/b/c" },
      { color: undefined },
      { params: [1] },
      { params: { "1x": 1 } },
      { params: { x: Number.NaN } },
      { params: { x: 1e9 } },
      { params: { x: "oklch(50% 0 0)" } },
      { params: { x: "red" } },
      { params: { x: [1, "#fff"] } },
      { params: { x: [] } },
      { params: { x: Array.from({ length: 9 }, () => 1) } },
      { params: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`p${i}`, i])) },
      { speed: 5 },
      { speed: -1 },
      { poster: "javascript:alert(1)" },
      { posterSrcSet: "http://x.test/a.webp 1x" },
    ];
    for (const patch of bad) expect(parseCardBackground({ ...silk, ...patch })).toBeNull();
  });

  it("paints its colour, measures it and hands it to the frost", () => {
    const plain = { type: "shader", shader: "mesh", color: "#fbf8f1" } as const;
    expect(backgroundStyle(silk)).toEqual({ backgroundColor: "#1b1530" });
    expect(backgroundTone(plain)).toBe("light");
    expect(backgroundInk(silk)).toBe("#ffffff");
    expect(frostBase(silk)).toEqual({ kind: "solid", color: "#1b1530" });
  });
});

describe("tone and ink", () => {
  it("measures luminance, averaging a gradient's stops", () => {
    expect(backgroundTone(ink)).toBe("dark");
    expect(backgroundTone({ type: "solid", color: "#fbf8f1" })).toBe("light");
    expect(backgroundTone({ type: "solid", color: "rgb(255, 138, 92)" })).toBe("light");
    expect(backgroundTone({ type: "solid", color: "oklch(90% 0 0)" })).toBe("dark");
  });

  it("prefers the stated tone and ink", () => {
    expect(backgroundTone({ type: "solid", color: "#fff", tone: "dark" })).toBe("dark");
    expect(backgroundInk(ink)).toBe("#ffffff");
    expect(backgroundInk({ type: "solid", color: "#fff" })).toBe("#16150f");
    expect(backgroundInk({ ...ink, ink: "#f1dfa6" })).toBe("#f1dfa6");
  });
});

describe("paint", () => {
  it("writes the CSS", () => {
    expect(backgroundStyle(ink)).toEqual({
      backgroundImage: "linear-gradient(135deg, #34322d 0%, #080807 100%)",
    });
    expect(backgroundStyle({ type: "radial", stops: ink.stops, at: [0.25, 0] })).toEqual({
      backgroundImage: "radial-gradient(circle farthest-corner at 25% 0%, #34322d 0%, #080807 100%)",
    });
    expect(backgroundStyle(holo)).toEqual({ backgroundColor: "#6d5a8f" });
  });

  it("gives the frost its base", () => {
    expect(frostBase(ink)).toEqual({ kind: "linear", angle: 135, stops: ink.stops });
    expect(frostBase(holo)).toEqual({ kind: "solid", color: "#6d5a8f" });
  });
});
