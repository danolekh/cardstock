import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  hexToRgb,
  luminance,
  oklchToRgb,
  rgbToHex,
  rgbToOklch,
  suggestInk,
} from "../src/color.ts";

describe("luminance and contrast", () => {
  it("matches WCAG at the ends and in the middle", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
    // #777 is the classic 4.48:1 grey on white.
    expect(contrastRatio(luminance([119, 119, 119]), 1)).toBeCloseTo(4.48, 2);
    expect(contrastRatio(0, 1)).toBe(21);
    expect(contrastRatio(1, 0)).toBe(21);
  });

  it("reads and writes hex", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#c7b5f4")).toEqual([199, 181, 244]);
    expect(hexToRgb("rgb(1 2 3)")).toBeNull();
    expect(rgbToHex([199.4, 300, -4])).toBe("#c7ff00");
  });
});

describe("OKLCH", () => {
  it("round-trips sRGB colours", () => {
    for (const hex of ["#c7b5f4", "#145060", "#e0512b", "#808080", "#000000", "#ffffff"]) {
      expect(rgbToHex(oklchToRgb(rgbToOklch(hexToRgb(hex)!)))).toBe(hex);
    }
  });

  it("gives known values", () => {
    const [l, c] = rgbToOklch([255, 255, 255]);
    expect(l).toBeCloseTo(1, 4);
    expect(c).toBeCloseTo(0, 4);
    // sRGB red is about oklch(0.628 0.258 29.2).
    const red = rgbToOklch([255, 0, 0]);
    expect(red[0]).toBeCloseTo(0.628, 3);
    expect(red[1]).toBeCloseTo(0.258, 3);
    expect(red[2]).toBeCloseTo(29.2, 1);
  });

  it("suggests a near-white ink on dark and a near-black one on light, tinted by the hue", () => {
    const onDark = hexToRgb(suggestInk("dark", [20, 80, 96]))!;
    const onLight = hexToRgb(suggestInk("light", [199, 181, 244]))!;
    expect(luminance(onDark)).toBeGreaterThan(0.85);
    expect(luminance(onLight)).toBeLessThan(0.03);
    expect(rgbToOklch(onDark)[1]).toBeGreaterThan(0.01);
    // A grey tint stays neutral.
    const [r, g, b] = hexToRgb(suggestInk("dark", [128, 128, 128]))!;
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});
