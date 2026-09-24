import { describe, expect, it, vi } from "vitest";

import type { Backend, FrameInput } from "./backend";
import { defineShader } from "./define";
import { createScheduler, type SurfaceOptions, type SurfaceStatus } from "./scheduler";

const def = defineShader({ id: "test/s", label: "S", source: "void main() {}", still: 2 });

function setup(opts: { backend?: () => Backend | null } = {}) {
  const draws: { def: string; input: FrameInput }[] = [];
  const lost = new Set<() => void>();
  let isLost = false;
  let backends = 0;
  const fakeBackend = (): Backend => {
    backends++;
    isLost = false;
    return {
      present: "2d",
      prepare: () => "ready",
      draw: (d, input) => (draws.push({ def: d.id, input }), true),
      grab: () => null,
      onLost: (l) => lost.add(l),
      get lost() {
        return isLost;
      },
      dispose() {},
    };
  };
  let frames: ((now: number) => void)[] = [];
  let clock = 0;
  let hidden = false;
  let visibility = () => {};
  const intersect: ((el: Element, v: boolean) => void)[] = [];
  const scheduler = createScheduler({
    createBackend: opts.backend ?? fakeBackend,
    now: () => clock,
    requestFrame: (cb) => frames.push(cb),
    cancelFrame: () => (frames = []),
    observe: (onChange) => (intersect.push(onChange), { observe() {}, unobserve() {} }),
    resize: null,
    hidden: () => hidden,
    onVisibility: (l) => (visibility = l),
    dpr: () => 2,
  });
  const run = (ms = 16, count = 1) => {
    for (let i = 0; i < count; i++) {
      clock += ms;
      const due = frames;
      frames = [];
      due.forEach((f) => f(clock));
    }
  };
  const add = (patch: Partial<SurfaceOptions> = {}, freeze = () => 0) => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 200 });
    Object.defineProperty(canvas, "clientHeight", { value: 126 });
    canvas.getContext = (() => ({})) as never;
    const statuses: SurfaceStatus[] = [];
    const handle = scheduler.add(
      canvas,
      { definition: def, uniforms: [], speed: 1, state: "play", maxDpr: 2, maxPixels: 1e6, ...patch },
      { freeze, flip: () => 0, pointer: () => [0.5, 0.5] },
      (s) => statuses.push(s),
    );
    intersect.forEach((f) => f(canvas, true));
    return { canvas, handle, statuses };
  };
  return {
    scheduler,
    draws,
    run,
    add,
    frames: () => frames.length,
    backends: () => backends,
    lose: () => ((isLost = true), lost.forEach((l) => l())),
    setHidden: (h: boolean) => ((hidden = h), visibility()),
  };
}

describe("the shader scheduler", () => {
  it("draws every surface from one backend, starting at the still frame", () => {
    const t = setup();
    t.add();
    t.add();
    t.run();
    expect(t.backends()).toBe(1);
    expect(t.draws).toHaveLength(2);
    expect(t.draws[0]!.input).toMatchObject({ width: 400, height: 252, pixelRatio: 2, time: 2 });
    t.run(16, 3);
    expect(t.draws.at(-1)!.input.time).toBeGreaterThan(2);
  });

  it("reports ready and playing once it has drawn", () => {
    const t = setup();
    const { statuses } = t.add();
    t.run(16, 2);
    expect(statuses.at(-1)).toEqual({ ready: true, playing: true, failed: false });
  });

  it("draws a held surface once, then stops the loop", () => {
    const t = setup();
    t.add({ state: "hold" });
    t.run(16, 5);
    expect(t.draws).toHaveLength(1);
    expect(t.frames()).toBe(0);
  });

  it("keeps reduced motion on the still frame", () => {
    const t = setup();
    const { handle } = t.add();
    t.run(16, 5);
    handle.update({ state: "still" });
    t.run(16, 3);
    expect(t.draws.at(-1)!.input.time).toBe(2);
    expect(t.frames()).toBe(0);
  });

  it("caps the frame rate", () => {
    const t = setup();
    const slow = defineShader({ id: "test/slow", label: "Slow", source: "", fps: 20 });
    t.add({ definition: slow });
    t.run(16, 30);
    // 480ms at 20fps is about ten frames, not thirty.
    expect(t.draws.length).toBeLessThanOrEqual(11);
    expect(t.draws.length).toBeGreaterThanOrEqual(8);
  });

  it("stops in a hidden tab and resumes when it's shown", () => {
    const t = setup();
    t.add();
    t.run();
    t.setHidden(true);
    t.run(16, 5);
    const drawn = t.draws.length;
    expect(t.frames()).toBe(0);
    t.setHidden(false);
    t.run(16, 2);
    expect(t.draws.length).toBeGreaterThan(drawn);
  });

  it("slows to a stop as the card freezes, and stops drawing once frozen", () => {
    const t = setup();
    let freeze = 0;
    t.add({}, () => freeze);
    t.run(16, 3);
    freeze = 1;
    t.run(16, 3);
    const frozenAt = t.draws.at(-1)!.input.time;
    t.run(16, 5);
    expect(t.draws.at(-1)!.input.time).toBe(frozenAt);
    expect(t.frames()).toBe(0);
  });

  it("rebuilds after a lost context, and gives up on a second loss soon after", () => {
    const t = setup();
    const { statuses } = t.add();
    t.run(16, 2);
    t.lose();
    t.run(16, 2);
    expect(t.backends()).toBe(2);
    expect(statuses.at(-1)).toMatchObject({ ready: true, failed: false });
    t.lose();
    t.run(16, 2);
    expect(statuses.at(-1)).toMatchObject({ ready: false, failed: true });
  });

  it("fails every surface when there's no WebGL2", () => {
    const t = setup({ backend: () => null });
    const { statuses } = t.add();
    t.run();
    expect(statuses.at(-1)).toMatchObject({ failed: true });
  });

  it("draws fewer pixels when frames keep arriving late", () => {
    const t = setup();
    t.add();
    t.run(16, 2);
    const full = t.draws.at(-1)!.input.width;
    t.run(40, 25);
    expect(t.draws.at(-1)!.input.width).toBeLessThan(full);
  });

  it("warns once for a program that won't compile", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup({
      backend: () => ({
        present: "2d",
        prepare: () => new Error("nope"),
        draw: () => false,
        grab: () => null,
        onLost() {},
        lost: false,
        dispose() {},
      }),
    });
    const { statuses } = t.add();
    t.run(16, 3);
    expect(statuses.at(-1)).toMatchObject({ failed: true });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
