import { describe, expect, it } from "vitest";

import {
  backgroundInk,
  backgroundStyle,
  backgroundTone,
  type CardBackground,
  frostBase,
  parseCardBackground,
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
