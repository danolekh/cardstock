import { describe, expect, it } from "vitest";

import { fitSize, imageUrl, place, splitLayers, tiles } from "./fit";

const box = { x: 0, y: 0, w: 200, h: 100 };
const square = { w: 50, h: 50 };

describe("fitSize", () => {
  it("covers and contains by the image's ratio", () => {
    expect(fitSize(box, square, "cover")).toEqual({ w: 200, h: 200 });
    expect(fitSize(box, square, "contain")).toEqual({ w: 100, h: 100 });
  });

  it("fills, keeps the natural size, and scales down only when too big", () => {
    expect(fitSize(box, square, "fill")).toEqual({ w: 200, h: 100 });
    expect(fitSize(box, square, "none")).toEqual(square);
    expect(fitSize(box, square, "scale-down")).toEqual(square);
    expect(fitSize(box, { w: 400, h: 400 }, "scale-down")).toEqual({ w: 100, h: 100 });
  });

  it("resolves lengths, percentages and auto", () => {
    expect(fitSize(box, square, "auto")).toEqual(square);
    expect(fitSize(box, square, "50%")).toEqual({ w: 100, h: 100 });
    expect(fitSize(box, square, "20px 10%")).toEqual({ w: 20, h: 10 });
    expect(fitSize(box, square, "auto 40px")).toEqual({ w: 40, h: 40 });
  });
});

describe("place", () => {
  it("positions by percentages of the free space, lengths and keywords", () => {
    expect(place(box, square, "50% 50%")).toEqual({ x: 75, y: 25, w: 50, h: 50 });
    expect(place(box, square, "100% 0%")).toEqual({ x: 150, y: 0, w: 50, h: 50 });
    expect(place(box, square, "10px 20px")).toEqual({ x: 10, y: 20, w: 50, h: 50 });
    expect(place({ ...box, x: 5 }, square, "left bottom")).toEqual({ x: 5, y: 50, w: 50, h: 50 });
  });
});

describe("tiles", () => {
  const first = { x: 10, y: 0, w: 50, h: 50 };
  it("draws once without repeat", () => {
    expect(tiles(box, first, "no-repeat")).toEqual([first]);
  });

  it("covers the box, starting before the first tile when it is offset", () => {
    const xs = tiles(box, first, "repeat-x").map((t) => t.x);
    expect(xs).toEqual([-40, 10, 60, 110, 160]);
    expect(tiles(box, first, "repeat")).toHaveLength(10);
  });
});

describe("layers", () => {
  it("splits at top-level commas and reads url images", () => {
    const layers = splitLayers('url("a.png"), linear-gradient(red, blue), url(b.jpg)');
    expect(layers).toHaveLength(3);
    expect(layers.map(imageUrl)).toEqual(["a.png", null, "b.jpg"]);
  });
});
