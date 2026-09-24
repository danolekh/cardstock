import { describe, expect, it } from "vitest";

import { DEFAULT_SPRING, isSettled, rubberBand, snapTarget, stepSpring } from "./physics";

const base = { index: 1, count: 4, flickVelocity: 1.2 };

describe("snapTarget", () => {
  it("returns to the same card after a slow, short drag", () => {
    expect(snapTarget({ ...base, position: 1.3, velocity: 0.1 })).toBe(1);
  });
  it("moves one card on a flick even when the drag was short", () => {
    expect(snapTarget({ ...base, position: 1.05, velocity: 3 })).toBe(2);
    expect(snapTarget({ ...base, position: 0.95, velocity: -3 })).toBe(0);
  });
  it("never moves more than one card", () => {
    expect(snapTarget({ ...base, position: 2.9, velocity: 20 })).toBe(2);
  });
  it("stays inside the ends", () => {
    expect(snapTarget({ ...base, index: 3, position: 3.2, velocity: 5 })).toBe(3);
    expect(snapTarget({ ...base, index: 0, position: -0.2, velocity: -5 })).toBe(0);
  });
  it("lands past halfway on the next card", () => {
    expect(snapTarget({ ...base, position: 1.6, velocity: 0 })).toBe(2);
  });
});

describe("rubberBand", () => {
  it("moves 1:1 inside and at a fraction past the ends", () => {
    expect(rubberBand(1.5, 4)).toBe(1.5);
    expect(rubberBand(-1, 4)).toBeCloseTo(-0.18);
    expect(rubberBand(4, 4)).toBeCloseTo(3.18);
  });
});

describe("stepSpring", () => {
  it("settles on the target within a second without overshooting much", () => {
    let [x, v] = [0, 0];
    let peak = 0;
    let t = 0;
    while (!isSettled(x, v, 1) && t < 2) {
      [x, v] = stepSpring(x, v, 1, DEFAULT_SPRING, 1 / 60);
      peak = Math.max(peak, x);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(1);
    expect(peak).toBeLessThan(1.05);
  });
  it("carries the release speed", () => {
    const [, still] = stepSpring(0, 0, 0, DEFAULT_SPRING, 1 / 60);
    const [moved] = stepSpring(0, 5, 0, DEFAULT_SPRING, 1 / 60);
    expect(still).toBe(0);
    expect(moved).toBeGreaterThan(0);
  });
});
