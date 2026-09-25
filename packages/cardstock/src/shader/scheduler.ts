/* One loop for every <Shader /> on the page: one backend, one requestAnimationFrame, one
 * IntersectionObserver. A surface is drawn only when something it shows has changed (its clock,
 * the pointer, the flip or freeze, an overlay, its size), so a held card costs nothing, and the
 * loop stops altogether when no surface needs a frame. */

import { type Backend, createBackend, type FrameInput } from "./backend";
import type { ShaderDefinition } from "./define";
import type { ResolvedUniform } from "./params";
import { advance, type PlayState } from "./policy";

/** What a surface is told as it changes. */
export interface SurfaceStatus {
  ready: boolean;
  playing: boolean;
  failed: boolean;
}

/** What a surface reads each frame, without re-rendering React. */
export interface SurfaceInputs {
  freeze: () => number;
  flip: () => number;
  pointer: () => readonly [number, number];
}

export interface SurfaceOptions {
  definition: ShaderDefinition | null;
  uniforms: readonly ResolvedUniform[];
  speed: number;
  state: PlayState;
  maxDpr: number;
  maxPixels: number;
}

/** A pass drawn over a surface's content into a canvas of its own, sampling the surface's live
 * frame: the frost. */
export interface OverlayOptions {
  /** Its fragment shader; see `OverlayInput` in ./backend. */
  source: string;
  /** 0 hides it (its canvas is cleared once and the pass skipped). */
  progress: () => number;
  /** Called after each frame the overlay draws. */
  onDraw?: () => void;
}

export interface OverlayHandle {
  /** The content under the overlay, drawn over the surface's frame where it's opaque. */
  setContent(content: TexImageSource | null): void;
  remove(): void;
}

export interface SurfaceHandle {
  update(options: Partial<SurfaceOptions>): void;
  /** Something read through the inputs changed: draw again if it shows. */
  wake(): void;
  /** Draws `overlay` over this surface into `canvas`, from the same frames. */
  attachOverlay(canvas: HTMLCanvasElement, overlay: OverlayOptions): OverlayHandle;
  remove(): void;
}

interface Overlay extends OverlayOptions {
  canvas: HTMLCanvasElement;
  target: CanvasRenderingContext2D | null;
  content: TexImageSource | null;
  contentVersion: number;
  /** Its canvas is blank, after a progress of 0. */
  cleared: boolean;
}

interface Surface extends SurfaceOptions {
  canvas: HTMLCanvasElement;
  inputs: SurfaceInputs;
  onStatus: (status: SurfaceStatus) => void;
  target: CanvasRenderingContext2D | null;
  overlay: Overlay | null;
  seed: number;
  time: number;
  frame: number;
  pointer: [number, number];
  /** CSS size, from the ResizeObserver. */
  cssWidth: number;
  cssHeight: number;
  intersecting: boolean;
  lastDraw: number;
  /** What the last frame showed; a frame that would look the same is skipped. */
  shown: string;
  status: SurfaceStatus;
  unregister?: () => void;
}

/** A lost context is rebuilt once; a second loss this soon after means the GPU won't keep one. */
const LOSS_WINDOW_MS = 10_000;
const BUDGET_MS = 1000 / 60;
const SLOW_FRAMES = 20;
const RECOVER_MS = 5000;
const MIN_ADAPTIVE = 0.4;

export interface Scheduler {
  add(
    canvas: HTMLCanvasElement,
    options: SurfaceOptions,
    inputs: SurfaceInputs,
    onStatus: (s: SurfaceStatus) => void,
  ): SurfaceHandle;
}

export interface SchedulerEnv {
  createBackend: () => Backend | null;
  now: () => number;
  requestFrame: (cb: (now: number) => void) => number;
  cancelFrame: (id: number) => void;
  observe:
    | ((onChange: (canvas: Element, intersecting: boolean) => void) => {
        observe: (el: Element) => void;
        unobserve: (el: Element) => void;
      })
    | null;
  resize:
    | ((onChange: (canvas: Element, width: number, height: number) => void) => {
        observe: (el: Element) => void;
        unobserve: (el: Element) => void;
      })
    | null;
  hidden: () => boolean;
  onVisibility: (listener: () => void) => void;
  dpr: () => number;
}

export function createScheduler(env: SchedulerEnv): Scheduler {
  const surfaces = new Set<Surface>();
  const byCanvas = new Map<Element, Surface>();
  let backend: Backend | null | undefined;
  let failed = false;
  let lastLoss = -Infinity;
  let raf = 0;
  let last = 0;
  let adaptive = 1;
  let slow = 0;
  let goodSince = 0;

  const io = env.observe?.((el, intersecting) => {
    const s = byCanvas.get(el);
    if (!s) return;
    s.intersecting = intersecting;
    schedule();
  });
  const ro = env.resize?.((el, width, height) => {
    const s = byCanvas.get(el);
    if (!s) return;
    s.cssWidth = width;
    s.cssHeight = height;
    schedule();
  });
  env.onVisibility(() => {
    last = 0;
    schedule();
  });

  const setStatus = (s: Surface, patch: Partial<SurfaceStatus>) => {
    const next = { ...s.status, ...patch };
    if (next.ready === s.status.ready && next.playing === s.status.playing && next.failed === s.status.failed)
      return;
    s.status = next;
    s.onStatus(next);
  };

  const getBackend = (): Backend | null => {
    if (failed) return null;
    if (backend && !backend.lost) return backend;
    backend = env.createBackend();
    if (!backend) {
      failed = true;
      surfaces.forEach((s) => setStatus(s, { failed: true, ready: false, playing: false }));
      return null;
    }
    backend.onLost(() => {
      const now = env.now();
      if (now - lastLoss < LOSS_WINDOW_MS) failed = true;
      lastLoss = now;
      // The surfaces' canvases are bound to the old backend's way of taking frames; start them
      // over, showing their posters until the new context draws.
      surfaces.forEach((s) => {
        s.shown = "";
        if (s.overlay) s.overlay.contentVersion++;
        setStatus(s, { ready: false, playing: false, failed });
      });
      schedule();
    });
    return backend;
  };

  const size = (s: Surface) => {
    const dpr = Math.min(env.dpr(), s.maxDpr);
    const scale = (s.definition?.scale ?? 1) * adaptive;
    let w = s.cssWidth * dpr * scale;
    let h = s.cssHeight * dpr * scale;
    if (w * h > s.maxPixels) {
      const k = Math.sqrt(s.maxPixels / (w * h));
      w *= k;
      h *= k;
    }
    return [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))] as const;
  };

  const input = (s: Surface, [width, height]: readonly [number, number]): FrameInput => ({
    width,
    height,
    pixelRatio: s.cssWidth ? width / s.cssWidth : 1,
    time: s.time,
    pointer: s.pointer,
    flip: s.inputs.flip(),
    freeze: s.inputs.freeze(),
    seed: s.seed,
    frame: s.frame,
    uniforms: s.uniforms,
  });

  const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
    try {
      return canvas.getContext("2d");
    } catch {
      return null;
    }
  };

  /** Steps one surface; true while it still wants frames. */
  const step = (s: Surface, b: Backend, now: number, dt: number): boolean => {
    const def = s.definition;
    if (!def || s.status.failed) return false;
    const visible = s.intersecting && !env.hidden() && s.cssWidth > 0 && s.cssHeight > 0;
    const playing = s.state === "play" && visible;
    setStatus(s, { playing });
    if (!visible) return false;

    const prepared = b.prepare(def);
    if (prepared instanceof Error) {
      console.error(prepared.message);
      setStatus(s, { failed: true, ready: false, playing: false });
      return false;
    }
    if (prepared === "pending") return true;

    if (s.state === "still") s.time = def.still ?? 0;
    else if (playing) s.time = advance(s.time, dt, s.speed);
    // The pointer eases toward where it is, as the tilt surface does, so a foil doesn't jump.
    const [tx, ty] = s.inputs.pointer();
    const k = 1 - Math.exp(-dt * 12);
    s.pointer = [s.pointer[0] + (tx - s.pointer[0]) * k, s.pointer[1] + (ty - s.pointer[1]) * k];
    if (Math.abs(tx - s.pointer[0]) < 1e-4 && Math.abs(ty - s.pointer[1]) < 1e-4) s.pointer = [tx, ty];
    const settling = s.pointer[0] !== tx || s.pointer[1] !== ty;

    const overlay = s.overlay;
    const progress = overlay ? overlay.progress() : 0;
    let overlayPending = false;
    if (overlay && progress > 0) {
      const state = b.prepareOverlay(overlay.source);
      if (state instanceof Error) {
        console.error(state.message);
        overlay.progress = () => 0;
      } else overlayPending = state === "pending";
    }
    const wants = () => settling || playing || overlayPending;

    const dims = size(s);
    const frame = input(s, dims);
    const key = `${dims[0]}x${dims[1]}|${frame.time}|${s.pointer[0]},${s.pointer[1]}|${frame.flip}|${frame.freeze}|${overlayPending ? "…" : progress}|${overlay?.contentVersion ?? ""}`;
    const fpsGap = 1000 / Math.min(60, def.fps ?? 60) - 2;
    if (key === s.shown) return wants();
    if (s.status.ready && playing && now - s.lastDraw < fpsGap) return true;

    s.target ??= context2d(s.canvas);
    if (overlay) overlay.target ??= context2d(overlay.canvas);
    const layered = overlay?.target && progress > 0 && !overlayPending;
    const drawn = s.target
      ? b.draw(
          def,
          frame,
          s.target,
          layered
            ? {
                source: overlay.source,
                progress,
                content: overlay.content,
                contentVersion: overlay.contentVersion,
                target: overlay.target!,
              }
            : undefined,
        )
      : false;
    if (!drawn) return !b.lost;
    if (overlay && progress === 0 && !overlay.cleared && overlay.target) {
      overlay.target.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height);
      overlay.cleared = true;
    }
    if (layered) {
      overlay.cleared = false;
      overlay.onDraw?.();
    }
    s.frame++;
    s.lastDraw = now;
    s.shown = key;
    setStatus(s, { ready: true });
    return wants();
  };

  const tick = (now: number) => {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    const gap = last ? now - last : 0;
    last = now;
    const b = getBackend();
    if (!b) return;
    let again = false;
    let anyPlaying = false;
    for (const s of surfaces) {
      if (step(s, b, now, dt)) again = true;
      if (s.status.playing) anyPlaying = true;
    }
    // Frames arriving well late for long enough mean the GPU is behind: draw fewer pixels. A long
    // stretch of good frames earns them back.
    if (anyPlaying && gap) {
      if (gap > BUDGET_MS * 1.5) {
        goodSince = now;
        if (++slow >= SLOW_FRAMES && adaptive > MIN_ADAPTIVE) {
          adaptive = Math.max(MIN_ADAPTIVE, adaptive * 0.8);
          slow = 0;
        }
      } else {
        slow = 0;
        if (!goodSince) goodSince = now;
        if (adaptive < 1 && now - goodSince > RECOVER_MS) {
          adaptive = Math.min(1, adaptive * 1.1);
          goodSince = now;
        }
      }
    }
    if (again && !env.hidden()) raf = env.requestFrame(tick);
    else last = 0;
  };

  function schedule() {
    if (!raf && surfaces.size && !env.hidden()) raf = env.requestFrame(tick);
  }

  return {
    add(canvas, options, inputs, onStatus) {
      const s: Surface = {
        ...options,
        canvas,
        inputs,
        onStatus,
        target: null,
        overlay: null,
        seed: Math.random(),
        time: options.definition?.still ?? 0,
        frame: 0,
        pointer: [...inputs.pointer()] as [number, number],
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
        // Without an IntersectionObserver, assume it's in view.
        intersecting: !io,
        lastDraw: -Infinity,
        shown: "",
        status: { ready: false, playing: false, failed },
      };
      surfaces.add(s);
      byCanvas.set(canvas, s);
      io?.observe(canvas);
      ro?.observe(canvas);
      if (failed) onStatus(s.status);
      schedule();
      return {
        update(patch) {
          const hadDefinition = s.definition;
          Object.assign(s, patch);
          if (patch.definition !== undefined && patch.definition !== hadDefinition) {
            s.time = patch.definition?.still ?? 0;
            // A new shader gets a fresh chance to compile, unless there's no WebGL at all.
            setStatus(s, { failed, ready: false });
          }
          s.shown = "";
          schedule();
        },
        wake: schedule,
        attachOverlay(overlayCanvas, overlayOptions) {
          const overlay: Overlay = {
            ...overlayOptions,
            canvas: overlayCanvas,
            target: null,
            content: null,
            contentVersion: 0,
            cleared: false,
          };
          s.overlay = overlay;
          s.shown = "";
          schedule();
          return {
            setContent(content) {
              overlay.content = content;
              overlay.contentVersion++;
              schedule();
            },
            remove() {
              if (s.overlay === overlay) s.overlay = null;
            },
          };
        },
        remove() {
          surfaces.delete(s);
          byCanvas.delete(canvas);
          io?.unobserve(canvas);
          ro?.unobserve(canvas);
          if (!surfaces.size && raf) {
            env.cancelFrame(raf);
            raf = 0;
            last = 0;
          }
        },
      };
    },
  };
}

let page: Scheduler | null = null;

/** The page's scheduler, made on first use. */
export function pageScheduler(): Scheduler {
  if (page) return page;
  page = createScheduler({
    createBackend,
    now: () => performance.now(),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (id) => cancelAnimationFrame(id),
    observe:
      typeof IntersectionObserver === "undefined"
        ? null
        : (onChange) =>
            new IntersectionObserver(
              (entries) => entries.forEach((e) => onChange(e.target, e.isIntersecting)),
              { rootMargin: "64px" },
            ),
    resize:
      typeof ResizeObserver === "undefined"
        ? null
        : (onChange) =>
            new ResizeObserver((entries) =>
              entries.forEach((e) => {
                const box = e.contentBoxSize?.[0];
                onChange(
                  e.target,
                  box?.inlineSize ?? e.contentRect.width,
                  box?.blockSize ?? e.contentRect.height,
                );
              }),
            ),
    hidden: () => document.visibilityState === "hidden",
    onVisibility: (listener) => document.addEventListener("visibilitychange", listener),
    dpr: () => window.devicePixelRatio || 1,
  });
  return page;
}
