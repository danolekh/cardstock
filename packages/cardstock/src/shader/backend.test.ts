import { describe, expect, it } from "vitest";

import { createFit } from "./backend";

/** A canvas that counts how often its size is set, as each set reallocates a WebGL buffer. */
function counted() {
  let width = 1;
  let height = 1;
  const c = {
    resizes: 0,
    get width() {
      return width;
    },
    set width(v: number) {
      if (v !== width) c.resizes++;
      width = v;
    },
    get height() {
      return height;
    },
    set height(v: number) {
      if (v !== height) c.resizes++;
      height = v;
    },
  };
  return c;
}

describe("the shared canvas", () => {
  it("fits a card and its swatches without resizing every frame", () => {
    const canvas = counted();
    const fit = createFit(canvas, 5000);
    fit(760, 480, 0);
    const warm = canvas.resizes;
    for (let frame = 1; frame < 200; frame++) {
      const now = frame * 16;
      fit(760, 480, now);
      for (let i = 0; i < 8; i++) fit(170, 107, now);
    }
    expect(canvas.resizes).toBe(warm);
    expect([canvas.width, canvas.height]).toEqual([760, 480]);
  });

  it("grows at once for a larger surface, and shrinks back only after a quiet while", () => {
    const canvas = counted();
    const fit = createFit(canvas, 5000);
    fit(400, 250, 0);
    fit(800, 500, 100);
    expect([canvas.width, canvas.height]).toEqual([800, 500]);
    // The large one stops drawing; the small one keeps on.
    for (let now = 200; now < 12_000; now += 16) fit(400, 250, now);
    expect([canvas.width, canvas.height]).toEqual([400, 250]);
  });
});
