/* The one WebGL2 context every <Shader /> on the page shares. Browsers keep only about sixteen
 * contexts alive, so a carousel of shader cards can't have one each: instead each frame is drawn
 * here and copied into the card's own 2D canvas while the drawing buffer is still valid.
 *
 * Every surface draws into the bottom-left corner of the one canvas, which only ever grows to the
 * largest of them (and shrinks, rarely, once nothing that large has drawn for a while). Resizing it
 * per surface instead makes the GPU reallocate its drawing buffer every time the size changes, and
 * a page with a card and a row of small swatches did that several times a frame: flipping the
 * card stalled the page for over half a second.
 *
 * A surface can carry an overlay drawn over its content, such as the frost: then the background
 * is drawn into a texture first, copied out as usual, and the overlay's own program samples that
 * texture live (with a snapshot of the content), into the overlay's canvas. */

import { composeFragment, VERTEX } from "./compose";
import type { ShaderDefinition } from "./define";
import type { ResolvedUniform } from "./params";

export interface FrameInput {
  width: number;
  height: number;
  /** Pixels drawn per CSS pixel. */
  pixelRatio: number;
  time: number;
  pointer: readonly [number, number];
  flip: number;
  freeze: number;
  seed: number;
  frame: number;
  uniforms: readonly ResolvedUniform[];
}

/** A second pass over a surface, into a canvas of its own (the frost over the card's content). */
export interface OverlayInput {
  /** A complete GLSL ES 3.00 fragment shader taking `in vec2 vUv`, `uBackground` (the surface's
   * frame, live), `uContent` (the content snapshot, straight alpha), `uProgress` and `uAspect`. */
  source: string;
  progress: number;
  content: TexImageSource | null;
  /** Bumped whenever `content` changes, to upload it again. */
  contentVersion: number;
  target: CanvasRenderingContext2D;
}

export interface Backend {
  /** Compiles (in the background, where the GPU allows) and reports: ready, still compiling, or
   * the error that stops it. */
  prepare(definition: ShaderDefinition): "ready" | "pending" | Error;
  /** The same, for an overlay's program. */
  prepareOverlay(source: string): "ready" | "pending" | Error;
  /** Draws a frame into `target`, and the overlay (when its progress is above 0) into its own; false
   * if the program isn't ready or the context is gone. */
  draw(
    definition: ShaderDefinition,
    input: FrameInput,
    target: CanvasRenderingContext2D,
    overlay?: OverlayInput,
  ): boolean;
  /** Called once when the GPU takes the context away. */
  onLost(listener: () => void): void;
  readonly lost: boolean;
  dispose(): void;
}

interface Program {
  program: WebGLProgram;
  vertex: WebGLShader;
  fragment: WebGLShader;
  linked: boolean | null;
  locations: Map<string, WebGLUniformLocation | null>;
}

interface Target {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

const COMPLETION_STATUS_KHR = 0x91b1;
/** How long the canvas stays larger than anything drawing needs before it shrinks back. */
const SHRINK_AFTER_MS = 5000;
/** Framebuffers kept for sizes in use; a page rarely has more than a card and its swatches. */
const MAX_TARGETS = 4;

const UV_VERTEX = `#version 300 es
in vec2 a;
out vec2 vUv;
void main() {
  vUv = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}
`;

const COPY = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 fragColor;
void main() { fragColor = texture(uTexture, vUv); }
`;

/** Sizes the shared canvas for a surface about to draw into its corner. It grows to fit at once,
 * and only shrinks once every few seconds, to the largest size drawn since the last time, so a
 * page of mixed sizes costs no reallocation per frame. */
export function createFit(
  canvas: { width: number; height: number },
  shrinkAfter: number = SHRINK_AFTER_MS,
): (w: number, h: number, now: number) => void {
  let recent = { w: 0, h: 0, since: 0 };
  return (w, h, now) => {
    recent = { w: Math.max(recent.w, w), h: Math.max(recent.h, h), since: recent.since };
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.max(canvas.width, w);
      canvas.height = Math.max(canvas.height, h);
    } else if (now - recent.since > shrinkAfter) {
      if (canvas.width > recent.w || canvas.height > recent.h) {
        canvas.width = recent.w;
        canvas.height = recent.h;
      }
      recent = { w, h, since: now };
    }
  };
}

export function createBackend(): Backend | null {
  const offscreen = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : null;
  const canvas = offscreen ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!canvas) return null;
  const options: WebGLContextAttributes = {
    // With alpha, so an overlay's transparent parts stay transparent when copied out.
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  };
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", options) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  // An OffscreenCanvas without WebGL2 (older Safari) still leaves the on-page route.
  if (!gl && offscreen) return createBackendOn(document.createElement("canvas"), options);
  if (!gl) return null;
  return safely(() => createBackendWith(canvas, gl));
}

function createBackendOn(canvas: HTMLCanvasElement, options: WebGLContextAttributes): Backend | null {
  const gl = canvas.getContext("webgl2", options);
  return gl ? safely(() => createBackendWith(canvas, gl)) : null;
}

/** A context that fails its setup (a stub in a test DOM, a GPU refusing the first buffer) counts
 * as no WebGL2. */
function safely(create: () => Backend): Backend | null {
  try {
    return create();
  } catch {
    return null;
  }
}

function createBackendWith(canvas: OffscreenCanvas | HTMLCanvasElement, gl: WebGL2RenderingContext): Backend {
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const programs = new Map<ShaderDefinition, Program | Error>();
  const overlays = new Map<string, Program | Error>();
  const targets = new Map<string, Target>();
  const contents = new WeakMap<CanvasRenderingContext2D, { texture: WebGLTexture; version: number }>();
  const listeners = new Set<() => void>();
  let lost = false;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle that covers the viewport.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const onLost = (e: Event) => {
    e.preventDefault();
    if (lost) return;
    lost = true;
    listeners.forEach((l) => l());
  };
  (canvas as HTMLCanvasElement).addEventListener("webglcontextlost", onLost);

  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };

  const build = (vertexSource: string, fragmentSource: string): Program => {
    const program = gl.createProgram()!;
    const vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "a");
    gl.linkProgram(program);
    return { program, vertex, fragment, linked: null, locations: new Map() };
  };

  /** Where a program stands; the link status is only read once the driver says it's done, since
   * reading it earlier blocks the frame until it is. */
  const settle = (entry: Program, name: string): "ready" | "pending" | Error => {
    if (entry.linked === null) {
      if (parallel && !gl.getProgramParameter(entry.program, COMPLETION_STATUS_KHR)) return "pending";
      entry.linked = !!gl.getProgramParameter(entry.program, gl.LINK_STATUS);
      if (!entry.linked) {
        const log =
          gl.getShaderInfoLog(entry.fragment) ||
          gl.getShaderInfoLog(entry.vertex) ||
          gl.getProgramInfoLog(entry.program) ||
          "";
        return new Error(`cardstock: ${name} didn't compile.\n${log}`);
      }
    }
    return "ready";
  };

  const prepare = (definition: ShaderDefinition): "ready" | "pending" | Error => {
    if (lost) return new Error("cardstock: the WebGL context was lost.");
    let entry = programs.get(definition);
    if (!entry) {
      try {
        entry = build(VERTEX, composeFragment(definition));
      } catch (err) {
        entry = err instanceof Error ? err : new Error(String(err));
      }
      programs.set(definition, entry);
    }
    if (entry instanceof Error) return entry;
    const state = settle(entry, `shader "${definition.id}"`);
    if (state instanceof Error) programs.set(definition, state);
    return state;
  };

  const prepareOverlay = (source: string): "ready" | "pending" | Error => {
    if (lost) return new Error("cardstock: the WebGL context was lost.");
    let entry = overlays.get(source);
    if (!entry) overlays.set(source, (entry = build(UV_VERTEX, source)));
    if (entry instanceof Error) return entry;
    const state = settle(entry, "the overlay");
    if (state instanceof Error) overlays.set(source, state);
    return state;
  };

  const copy = build(UV_VERTEX, COPY);

  const uniform = (entry: Program, name: string) => {
    let loc = entry.locations.get(name);
    if (loc === undefined) entry.locations.set(name, (loc = gl.getUniformLocation(entry.program, name)));
    return loc;
  };

  const fit = createFit(canvas);

  /** A texture to draw a frame into, kept per size. */
  const targetFor = (w: number, h: number): Target => {
    const key = `${w}x${h}`;
    let t = targets.get(key);
    if (t) {
      // Most recently used last, so the oldest is the one to drop.
      targets.delete(key);
      targets.set(key, t);
      return t;
    }
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    t = { framebuffer, texture };
    targets.set(key, t);
    if (targets.size > MAX_TARGETS) {
      const [oldKey, old] = targets.entries().next().value!;
      gl.deleteFramebuffer(old.framebuffer);
      gl.deleteTexture(old.texture);
      targets.delete(oldKey);
    }
    return t;
  };

  const contentFor = (overlay: OverlayInput): WebGLTexture => {
    let c = contents.get(overlay.target);
    if (!c) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Nothing yet: a transparent pixel, so the frost shows the background alone.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      contents.set(overlay.target, (c = { texture, version: -1 }));
    }
    if (c.version !== overlay.contentVersion && overlay.content) {
      gl.bindTexture(gl.TEXTURE_2D, c.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, overlay.content);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      c.version = overlay.contentVersion;
    }
    return c.texture;
  };

  const drawShader = (entry: Program, input: FrameInput) => {
    gl.useProgram(entry.program);
    const at = (name: string) => uniform(entry, name);
    gl.uniform1f(at("uTime"), input.time);
    gl.uniform2f(at("uResolution"), input.width, input.height);
    gl.uniform1f(at("uPixelRatio"), input.pixelRatio);
    gl.uniform2f(at("uPointer"), input.pointer[0], input.pointer[1]);
    gl.uniform2f(at("uTilt"), input.pointer[0] * 2 - 1, input.pointer[1] * 2 - 1);
    gl.uniform1f(at("uFlip"), input.flip);
    gl.uniform1f(at("uFreeze"), input.freeze);
    gl.uniform1f(at("uSeed"), input.seed);
    gl.uniform1i(at("uFrame"), input.frame);
    for (const u of input.uniforms) {
      if (u.kind === "float") gl.uniform1f(at(u.name), u.value);
      else if (u.kind === "vec3") gl.uniform3fv(at(u.name), u.value);
      else {
        gl.uniform3fv(at(u.name), u.value);
        gl.uniform1i(at(u.countName), u.count);
      }
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /** Copies the bottom-left `w`×`h` of the canvas into `target`, replacing what it held. */
  const present = (target: CanvasRenderingContext2D, w: number, h: number) => {
    if (target.canvas.width !== w || target.canvas.height !== h) {
      target.canvas.width = w;
      target.canvas.height = h;
    }
    target.globalCompositeOperation = "copy";
    target.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
  };

  return {
    prepare,
    prepareOverlay,
    draw(definition, input, target, overlay) {
      if (lost || prepare(definition) !== "ready") return false;
      const entry = programs.get(definition) as Program;
      const { width: w, height: h } = input;
      fit(w, h, performance.now());
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);

      const layered =
        overlay &&
        overlay.progress > 0 &&
        prepareOverlay(overlay.source) === "ready" &&
        settle(copy, "the copy pass") === "ready";
      if (!layered) {
        drawShader(entry, input);
        present(target, w, h);
        return true;
      }

      // The background into a texture, out to its canvas, and under the overlay.
      const frame = targetFor(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, frame.framebuffer);
      drawShader(entry, input);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(copy.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frame.texture);
      gl.uniform1i(uniform(copy, "uTexture"), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      present(target, w, h);

      const pass = overlays.get(overlay.source) as Program;
      gl.useProgram(pass.program);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, contentFor(overlay));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frame.texture);
      gl.uniform1i(uniform(pass, "uBackground"), 0);
      gl.uniform1i(uniform(pass, "uContent"), 1);
      gl.uniform1f(uniform(pass, "uProgress"), overlay.progress);
      gl.uniform1f(uniform(pass, "uAspect"), w / h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      present(overlay.target, w, h);
      return true;
    },
    onLost(listener) {
      listeners.add(listener);
    },
    get lost() {
      return lost;
    },
    dispose() {
      (canvas as HTMLCanvasElement).removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
