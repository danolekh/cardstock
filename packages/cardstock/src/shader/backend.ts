/* The one WebGL2 context every <Shader /> on the page shares. Browsers keep only about sixteen
 * contexts alive, so a carousel of shader cards can't have one each: instead each frame is drawn
 * here, at the card's size, and handed to the card's own canvas. With OffscreenCanvas that's a
 * transfer of the finished frame (`transferToImageBitmap`, no copy); without it, a hidden canvas
 * is copied into a 2D one while its drawing buffer is still valid. */

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

/** Where a surface's frames go: the card's canvas in the context kind the backend hands frames
 * over with. */
export type Target = ImageBitmapRenderingContext | CanvasRenderingContext2D;

export interface Backend {
  /** How a surface's canvas takes frames: `"bitmaprenderer"` or `"2d"`. */
  readonly present: "bitmaprenderer" | "2d";
  /** Compiles (in the background, where the GPU allows) and reports: ready, still compiling, or
   * the error that stops it. */
  prepare(definition: ShaderDefinition): "ready" | "pending" | Error;
  /** Draws a frame into `target`; false if the program isn't ready or the context is gone. */
  draw(definition: ShaderDefinition, input: FrameInput, target: Target): boolean;
  /** Draws a frame and returns the backend's canvas holding it, to be copied at once (the frost
   * snapshot); null when it can't. */
  grab(definition: ShaderDefinition, input: FrameInput): CanvasImageSource | null;
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

const COMPLETION_STATUS_KHR = 0x91b1;

export function createBackend(): Backend | null {
  const offscreen = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : null;
  const canvas = offscreen ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!canvas) return null;
  const options: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
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
  const isOffscreen = typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas;
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const programs = new Map<ShaderDefinition, Program | Error>();
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

  const failure = (p: Program, definition: ShaderDefinition) => {
    const log =
      gl.getShaderInfoLog(p.fragment) ||
      gl.getShaderInfoLog(p.vertex) ||
      gl.getProgramInfoLog(p.program) ||
      "";
    return new Error(`cardstock: shader "${definition.id}" didn't compile.\n${log}`);
  };

  const prepare = (definition: ShaderDefinition): "ready" | "pending" | Error => {
    if (lost) return new Error("cardstock: the WebGL context was lost.");
    let entry = programs.get(definition);
    if (!entry) {
      try {
        const fragmentSource = composeFragment(definition);
        const program = gl.createProgram()!;
        const vertex = shader(gl.VERTEX_SHADER, VERTEX);
        const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.bindAttribLocation(program, 0, "a");
        gl.linkProgram(program);
        entry = { program, vertex, fragment, linked: null, locations: new Map() };
      } catch (err) {
        entry = err instanceof Error ? err : new Error(String(err));
      }
      programs.set(definition, entry);
    }
    if (entry instanceof Error) return entry;
    if (entry.linked === null) {
      // With the extension the driver compiles on its own threads; asking for the link status
      // before it's done would block this frame until it is.
      if (parallel && !gl.getProgramParameter(entry.program, COMPLETION_STATUS_KHR)) return "pending";
      entry.linked = !!gl.getProgramParameter(entry.program, gl.LINK_STATUS);
      if (!entry.linked) {
        const err = failure(entry, definition);
        programs.set(definition, err);
        return err;
      }
    }
    return "ready";
  };

  const render = (definition: ShaderDefinition, input: FrameInput): boolean => {
    if (lost || prepare(definition) !== "ready") return false;
    const entry = programs.get(definition) as Program;
    if (canvas.width !== input.width || canvas.height !== input.height) {
      canvas.width = input.width;
      canvas.height = input.height;
    }
    gl.viewport(0, 0, input.width, input.height);
    gl.useProgram(entry.program);
    const at = (name: string) => {
      let loc = entry.locations.get(name);
      if (loc === undefined) entry.locations.set(name, (loc = gl.getUniformLocation(entry.program, name)));
      return loc;
    };
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
    return true;
  };

  return {
    present: isOffscreen ? "bitmaprenderer" : "2d",
    prepare,
    draw(definition, input, target) {
      if (!render(definition, input)) return false;
      if (isOffscreen) {
        (target as ImageBitmapRenderingContext).transferFromImageBitmap(
          (canvas as OffscreenCanvas).transferToImageBitmap(),
        );
      } else {
        const ctx = target as CanvasRenderingContext2D;
        if (ctx.canvas.width !== input.width || ctx.canvas.height !== input.height) {
          ctx.canvas.width = input.width;
          ctx.canvas.height = input.height;
        }
        ctx.drawImage(canvas as HTMLCanvasElement, 0, 0);
      }
      return true;
    },
    grab(definition, input) {
      return render(definition, input) ? canvas : null;
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
