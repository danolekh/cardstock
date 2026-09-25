import { describe, expect, it, vi } from "vitest";

import type { Backend, FrameInput, OverlayInput } from "./backend";
import { defineShader } from "./define";
import { createScheduler, type SurfaceOptions, type SurfaceStatus } from "./scheduler";

const def = defineShader({ id: "test/s", label: "S", source: "void main() {}", still: 2 });

function setup(opts: { backend?: () => Backend | null; overlay?: () => "ready" | "pending" } = {}) {
  const draws: { def: string; input: FrameInput; overlay?: OverlayInput }[] = [];
  const clears: HTMLCanvasElement[] = [];
  const lost = new Set<() => void>();
  let isLost = false;
  let backends = 0;
  const fakeBackend = (): Backend => {
    backends++;
    isLost = false;
    return {
      prepare: () => "ready",
      prepareOverlay: () => opts.overlay?.() ?? "ready",
      draw: (d, input, _target, overlay) => (draws.push({ def: d.id, input, overlay }), true),
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
    canvas.getContext = (() => ({ canvas })) as never;
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
  /** A canvas for an overlay, whose clears are recorded. */
  const overlayCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = (() => ({ canvas, clearRect: () => clears.push(canvas) })) as never;
    return canvas;
  };
  return {
    scheduler,
    draws,
    clears,
    run,
    add,
    overlayCanvas,
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

  it("keeps running while the card is frozen", () => {
    const t = setup();
    const { statuses } = t.add({}, () => 1);
    t.run(16, 5);
    expect(t.draws.at(-1)!.input.time).toBeGreaterThan(t.draws[0]!.input.time);
    expect(t.frames()).toBe(1);
    expect(statuses.at(-1)).toMatchObject({ playing: true });
  });

  it("draws an overlay from the same frames only while its progress is above 0", () => {
    const t = setup();
    let progress = 0;
    const { handle } = t.add({ state: "hold" });
    const canvas = t.overlayCanvas();
    const onDraw = vi.fn<() => void>();
    const overlay = handle.attachOverlay(canvas, { source: "frost", progress: () => progress, onDraw });
    t.run();
    expect(t.draws.at(-1)!.overlay).toBeUndefined();
    expect(t.clears).toEqual([canvas]);

    progress = 0.5;
    handle.wake();
    t.run();
    expect(t.draws.at(-1)!.overlay).toMatchObject({ source: "frost", progress: 0.5, contentVersion: 0 });
    expect(onDraw).toHaveBeenCalledTimes(1);

    // New content is uploaded with a new version, and redrawn even though nothing else changed.
    const content = document.createElement("canvas");
    overlay.setContent(content);
    t.run();
    expect(t.draws.at(-1)!.overlay).toMatchObject({ content, contentVersion: 1 });

    progress = 0;
    handle.wake();
    t.run();
    expect(t.clears).toEqual([canvas, canvas]);
    overlay.remove();
    progress = 1;
    handle.wake();
    t.run();
    expect(t.draws.at(-1)!.overlay).toBeUndefined();
  });

  it("keeps drawing the surface alone while the overlay compiles", () => {
    let state: "ready" | "pending" = "pending";
    const t = setup({ overlay: () => state });
    const { handle } = t.add({ state: "hold" });
    handle.attachOverlay(t.overlayCanvas(), { source: "frost", progress: () => 1 });
    t.run(16, 2);
    expect(t.draws.at(-1)!.overlay).toBeUndefined();
    expect(t.frames()).toBe(1);
    state = "ready";
    t.run();
    expect(t.draws.at(-1)!.overlay).toMatchObject({ progress: 1 });
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
        prepare: () => new Error("nope"),
        prepareOverlay: () => "ready",
        draw: () => false,
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
