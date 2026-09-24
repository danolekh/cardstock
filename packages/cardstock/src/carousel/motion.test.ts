import { afterEach, describe, expect, it, vi } from "vitest";

import { createCarouselMotion } from "./motion";
import { DEFAULT_SPRING, releaseVelocity } from "./physics";

afterEach(() => vi.unstubAllGlobals());

function frames() {
  let queued: FrameRequestCallback | undefined;
  let now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => ((queued = cb), 1));
  vi.stubGlobal("cancelAnimationFrame", () => (queued = undefined));
  vi.spyOn(performance, "now").mockImplementation(() => now);
  return (ms: number) => {
    now += ms;
    const cb = queued;
    queued = undefined;
    cb?.(now);
    return cb !== undefined;
  };
}

describe("carousel motion", () => {
  it("springs to the target and stops there", () => {
    const tick = frames();
    const motion = createCarouselMotion(0);
    motion.settleTo(1, 0, { snap: DEFAULT_SPRING, reduced: false });
    let ran = 0;
    while (tick(16) && ran++ < 200);
    expect(motion.position.get()).toBe(1);
    expect(ran).toBeLessThan(60);
  });

  it("carries the release speed into the spring", () => {
    const tick = frames();
    const still = createCarouselMotion(0);
    still.settleTo(1, 0, { snap: DEFAULT_SPRING, reduced: false });
    tick(16);
    const a = still.position.get();
    const tickB = frames();
    const thrown = createCarouselMotion(0);
    thrown.settleTo(1, 6, { snap: DEFAULT_SPRING, reduced: false });
    tickB(16);
    expect(thrown.position.get()).toBeGreaterThan(a);
  });

  it("eases over 200ms with reduced motion", () => {
    const tick = frames();
    const motion = createCarouselMotion(0);
    motion.settleTo(2, 10, { snap: DEFAULT_SPRING, reduced: true });
    tick(100);
    expect(motion.position.get()).toBeGreaterThan(0);
    expect(motion.position.get()).toBeLessThan(2);
    tick(100);
    expect(motion.position.get()).toBe(2);
  });

  it("jumps with snap off, and stops when cancelled", () => {
    const tick = frames();
    const motion = createCarouselMotion(0);
    motion.settleTo(1, 0, { snap: false, reduced: false });
    expect(motion.position.get()).toBe(1);
    motion.settleTo(0, 0, { snap: DEFAULT_SPRING, reduced: false });
    motion.cancel();
    expect(tick(16)).toBe(false);
  });

  it("tells subscribers about dragging only when it changes", () => {
    const motion = createCarouselMotion(0);
    const seen = vi.fn<() => void>();
    motion.dragging.subscribe(seen);
    motion.setDragging(true);
    motion.setDragging(true);
    motion.setDragging(false);
    expect(seen).toHaveBeenCalledTimes(2);
  });
});

describe("releaseVelocity", () => {
  it("measures the last 100ms", () => {
    expect(
      releaseVelocity([
        [0, 0],
        [50, 100],
        [150, 300],
      ]),
    ).toBe(2000);
    expect(
      releaseVelocity([
        [0, 0],
        [10, 0],
      ]),
    ).toBe(0);
    expect(releaseVelocity([])).toBe(0);
  });
});
