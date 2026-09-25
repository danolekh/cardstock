/* The frozen state as frosted glass, spreading from the middle of the face out.
 *
 * A port of "Spreading Frost" by dos (shadertoy XddcRr), built on Shadmar's "Frosted Glass II"
 * (MsySzy): sample the face at noise-jittered coordinates, tint it towards ice, and reveal that
 * through a vignette that grows with the freeze, its edge broken up by a coarse "ice spread"
 * noise. A shader can't read the DOM, so the face is first redrawn into a 2D canvas from an
 * untransformed clone, and that becomes the texture. The snapshot draws background colours (with
 * the top-left radius), `url()` background images (size, position and repeat), <img>s (object-fit
 * and object-position), inline SVGs, canvases, and text. Gradients in CSS aren't drawn (the card's
 * `background`, face's own), nor are borders, shadows, filters, transforms or pseudo-elements.
 * Over a <Shader />, the frost is drawn in the shader's context instead (FROST_LAYER), from the
 * live frame and a snapshot of the content alone, so the background keeps moving under it. A
 * cross-origin image is fetched with CORS; one its server doesn't allow is left out, not the whole
 * snapshot.
 *
 * Each pixel is a pure function of the freeze progress, so a reversal mid-way walks back through
 * the same frames. Without WebGL2, or with `webgl={false}`, a frosted gradient fades instead;
 * browsers cap live WebGL contexts, so cards that aren't in focus should use that. Every WebGL
 * session gets a fresh canvas (a canvas whose context was lost hands it back dead forever), and
 * the gradient stands in until the shader has its first snapshot, so a frozen card never shows
 * bare. Anything marked `data-frost-skip` is left out of the snapshot. */

import type { FrostBase } from "../background/background";
import { farthestCorner, fitSize, imageUrl, linearEnds, place, type Rect, splitLayers, tiles } from "./fit";

const VERT = `#version 300 es
in vec2 a;
out vec2 vUv;
void main() {
  vUv = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFace;
uniform float uProgress;
uniform float uAspect;

// Shadmar's hash, as in both originals.
float rand(vec2 uv) {
  float a = dot(uv, vec2(92.0, 80.0));
  float b = dot(uv, vec2(41.0, 62.0));
  return fract(sin(a) + cos(b) * 51.0);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.97;
}

void main() {
  vec2 uv = vUv;
  vec2 q = vec2(uv.x * uAspect, uv.y);

  // Stand-ins for the originals' texture channels: fine frost grain and the coarse ice spread.
  vec2 frost = vec2(fbm(q * 16.0), fbm(q * 16.0 + 7.3));
  float icespread = fbm(q * 3.2 + 2.0);

  vec2 rnd = vec2(rand(uv + frost.r * 0.05), rand(uv + frost.g * 0.05)) - 0.5;

  float p = clamp(uProgress, 0.0, 1.0);
  float size = mix(p, sqrt(p), 0.5) * 1.12 + 1e-7;
  vec2 lens = vec2(size, pow(size, 4.0) / 2.0);
  // Distance from the centre, scaled so the corners sit at 0.707 as they do on a square.
  float dist = length((uv - 0.5) * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0)) * 1.41421;
  // pow(1 - smoothstep(size, inner, d), 2), written with ordered edges.
  float vignette = pow(smoothstep(lens.y, lens.x, dist), 2.0);

  // Heavy scatter along the growth front, a finer frosted grain once the ice has set.
  vec2 offset = rnd * (0.013 + frost * vignette * 0.4);
  vec3 frozen = texture(uFace, clamp(uv + offset, 0.001, 0.999)).rgb * vec3(0.9, 0.9, 1.1);
  frozen = mix(frozen, vec3(0.84, 0.94, 1.0), 0.3 + 0.22 * frost.r);

  float amount = 1.0 - smoothstep(icespread, 1.0, vignette * vignette);
  outColor = vec4(frozen * amount, amount);
}`;

/** The same frost as a layer over a live background (a <Shader />), drawn in the shader's shared
 * context: the face it refracts is the background's current frame with the content snapshot
 * over it, so the background keeps moving under the ice. */
export const FROST_LAYER: string = FRAG.replace(
  "uniform sampler2D uFace;",
  `uniform sampler2D uBackground;
uniform sampler2D uContent;
vec4 face(vec2 uv) {
  vec4 content = texture(uContent, uv);
  return vec4(mix(texture(uBackground, uv).rgb, content.rgb, content.a), 1.0);
}`,
).replace("texture(uFace,", "face(");

export type Stop = readonly [color: string, at: number];

const INHERITED = [
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "direction",
];

type Op =
  | { kind: "bitmap"; box: Rect; r: number; frame: HTMLCanvasElement }
  | { kind: "box"; x: number; y: number; w: number; h: number; r: number; color: string }
  | { kind: "svg"; x: number; y: number; w: number; h: number; img: HTMLImageElement }
  | {
      kind: "image";
      box: Rect;
      r: number;
      size: string;
      position: string;
      repeat: string;
      img: Promise<HTMLImageElement | null>;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      font: string;
      color: string;
      spacing: string;
    };

export interface SnapshotOptions {
  /** false: leave out the card's background (`Card.Background` and the base), on a transparent
   * canvas, for a frost layered over a live background that's drawn separately. */
  background?: boolean;
}

/** Redraws the card face into a canvas: an untransformed clone is laid out off-screen, then each
 * background, image, SVG and text run is drawn where the browser placed it. */
export async function snapshotFace(
  face: HTMLElement,
  base: FrostBase | undefined,
  dpr: number,
  options: SnapshotOptions = {},
): Promise<HTMLCanvasElement | null> {
  const withBackground = options.background !== false;
  const w = face.offsetWidth;
  const h = face.offsetHeight;
  if (!w || !h) return null;

  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;container-type:inline-size;visibility:hidden;pointer-events:none;z-index:-1`;
  // The clone lives under <body>, away from the card, so give it what the face inherits there:
  // text styles and custom properties (a face coloured with `var(--card-ink)` set on an ancestor
  // would otherwise draw its text in the page's colour).
  const context = getComputedStyle(face.parentElement ?? face);
  for (const name of INHERITED) host.style.setProperty(name, context.getPropertyValue(name));
  for (let i = 0; i < context.length; i++) {
    const name = context.item(i);
    if (name.startsWith("--")) host.style.setProperty(name, context.getPropertyValue(name));
  }
  const clone = face.cloneNode(true) as HTMLElement;
  // A cloned canvas is blank: pair each with its original, to copy the frame it shows.
  const originals = new Map<Element, HTMLCanvasElement>();
  const sources = face.querySelectorAll("canvas");
  clone.querySelectorAll("canvas").forEach((c, i) => {
    const original = sources[i];
    if (original) originals.set(c, original);
  });
  if (!withBackground) clone.querySelectorAll('[data-slot="card-background"]').forEach((n) => n.remove());
  clone.style.transform = "none";
  clone.style.opacity = "1"; // a face faded out (the reduced-motion flip) still has its content
  clone.querySelectorAll("[data-frost-skip]").forEach((n) => n.remove());
  host.appendChild(clone);
  document.body.appendChild(host);

  const ops: Op[] = [];
  const loads: Promise<unknown>[] = [];
  const images = new Map<string, Promise<HTMLImageElement | null>>();
  const image = (src: string, box: Rect, r: number, size: string, position: string, repeat: string) => {
    let img = images.get(src);
    if (!img) images.set(src, (img = loadImage(src)));
    ops.push({ kind: "image", box, r, size, position, repeat, img });
  };

  try {
    const origin = host.getBoundingClientRect();
    const visit = (node: Node) => {
      if (node instanceof SVGSVGElement) {
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const copy = node.cloneNode(true) as SVGSVGElement;
        copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copy.setAttribute("width", String(r.width));
        copy.setAttribute("height", String(r.height));
        const img = new Image();
        loads.push(new Promise((ok) => ((img.onload = ok), (img.onerror = ok))));
        img.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(new XMLSerializer().serializeToString(copy));
        ops.push({
          kind: "svg",
          x: r.left - origin.left,
          y: r.top - origin.top,
          w: r.width,
          h: r.height,
          img,
        });
        return;
      }
      if (node instanceof HTMLElement) {
        const cs = getComputedStyle(node);
        if (cs.display === "none" || cs.opacity === "0") return;
        const r = node.getBoundingClientRect();
        const box = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
        const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.height / 2);
        if (node !== clone && !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor))
          ops.push({ kind: "box", ...box, r: radius, color: cs.backgroundColor });
        if (cs.backgroundImage !== "none") {
          const layers = splitLayers(cs.backgroundImage);
          const nth = (list: string, i: number, fallback: string) => {
            const values = splitLayers(list);
            return values[i % values.length] ?? fallback;
          };
          // The first layer is painted on top, so draw from the last.
          for (let i = layers.length - 1; i >= 0; i--) {
            const src = imageUrl(layers[i]!);
            if (src)
              image(
                src,
                box,
                radius,
                nth(cs.backgroundSize, i, "auto"),
                nth(cs.backgroundPosition, i, "0% 0%"),
                nth(cs.backgroundRepeat, i, "repeat"),
              );
          }
        }
        if (node instanceof HTMLCanvasElement) {
          const original = originals.get(node);
          // Copied now: a live canvas (a <Shader />) moves on while images load.
          const frame = original && copyFrame(original);
          if (frame) ops.push({ kind: "bitmap", box, r: radius, frame });
          return;
        }
        if (node instanceof HTMLImageElement) {
          const src = node.currentSrc || node.src;
          if (src) image(src, box, radius, cs.objectFit, cs.objectPosition, "no-repeat");
          return;
        }
        node.childNodes.forEach(visit);
        return;
      }
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() && node.parentElement) {
        const cs = getComputedStyle(node.parentElement);
        const range = document.createRange();
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        const raw = node.textContent.trim();
        ops.push({
          kind: "text",
          x: r.left - origin.left,
          y: r.top - origin.top + r.height / 2,
          text: cs.textTransform === "uppercase" ? raw.toUpperCase() : raw,
          font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
          color: cs.color,
          spacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
        });
      }
    };
    visit(clone);
  } finally {
    host.remove();
  }
  await Promise.all(loads);
  const loaded = new Map<Op, HTMLImageElement | null>();
  await Promise.all(ops.map(async (op) => op.kind === "image" && loaded.set(op, await op.img)));

  const drawn = paint(face, w, h, dpr, withBackground ? base : null, ops, loaded);
  if (!loaded.size) return drawn;
  // A cross-origin image served without CORS would taint the canvas, and WebGL refuses a tainted
  // texture. loadImage() leaves such images out, but a redirect can still slip one in: then the
  // face is drawn again without images.
  try {
    drawn.getContext("2d")!.getImageData(0, 0, 1, 1);
    return drawn;
  } catch {
    return paint(face, w, h, dpr, withBackground ? base : null, ops, new Map());
  }
}

/** The frame a canvas shows, copied into a canvas of its own; null if it can't be read. */
function copyFrame(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const { width: w, height: h } = source;
  if (!w || !h) return null;
  const copy = document.createElement("canvas");
  copy.width = w;
  copy.height = h;
  try {
    copy.getContext("2d")!.drawImage(source, 0, 0);
    return copy;
  } catch {
    return null;
  }
}

/** Loads an image for the snapshot. Other origins are asked for CORS, so the canvas stays readable;
 * null when it can't load that way. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  const url = new URL(src, document.baseURI);
  if (url.origin !== location.origin && url.protocol !== "data:" && url.protocol !== "blob:")
    img.crossOrigin = "anonymous";
  return new Promise((done) => {
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url.href;
  });
}

function paint(
  face: HTMLElement,
  w: number,
  h: number,
  dpr: number,
  /** null: no base at all, a transparent canvas. */
  base: FrostBase | undefined | null,
  ops: readonly Op[],
  images: ReadonlyMap<Op, HTMLImageElement | null>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // The background under everything, as CSS would paint it; without one, the face's own colour.
  if (base?.kind === "linear") {
    const g = ctx.createLinearGradient(...linearEnds(w, h, base.angle));
    for (const [color, at] of base.stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
  } else if (base?.kind === "radial") {
    const [x, y] = [base.at[0] * w, base.at[1] * h];
    const g = ctx.createRadialGradient(x, y, 0, x, y, farthestCorner(w, h, x, y));
    for (const [color, at] of base.stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
  } else ctx.fillStyle = base?.color ?? getComputedStyle(face).backgroundColor;
  if (base !== null) ctx.fillRect(0, 0, w, h);

  ctx.textBaseline = "middle";
  for (const op of ops) {
    if (op.kind === "bitmap") {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(op.box.x, op.box.y, op.box.w, op.box.h, op.r);
      ctx.clip();
      ctx.drawImage(op.frame, op.box.x, op.box.y, op.box.w, op.box.h);
      ctx.restore();
    } else if (op.kind === "box") {
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
      ctx.fill();
    } else if (op.kind === "svg") {
      if (op.img.naturalWidth) ctx.drawImage(op.img, op.x, op.y, op.w, op.h);
    } else if (op.kind === "image") {
      const img = images.get(op);
      if (!img?.naturalWidth || !img.naturalHeight) continue;
      const natural = { w: img.naturalWidth, h: img.naturalHeight };
      const first = place(op.box, fitSize(op.box, natural, op.size), op.position);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(op.box.x, op.box.y, op.box.w, op.box.h, op.r);
      ctx.clip();
      for (const t of tiles(op.box, first, op.repeat)) ctx.drawImage(img, t.x, t.y, t.w, t.h);
      ctx.restore();
    } else {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.letterSpacing = op.spacing;
      ctx.fillText(op.text, op.x, op.y);
    }
  }
  return canvas;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

export interface FrostRenderer {
  setFace: (face: HTMLCanvasElement) => void;
  draw: (progress: number, dpr: number) => void;
  dispose: () => void;
}

/** Sets up the program and returns its handles, or null when WebGL2 isn't there. */
export function createFrost(canvas: HTMLCanvasElement): FrostRenderer | null {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  try {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    gl.useProgram(prog);

    // One triangle that covers the viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(gl.getUniformLocation(prog, "uFace"), 0);

    const uProgress = gl.getUniformLocation(prog, "uProgress");
    const uAspect = gl.getUniformLocation(prog, "uAspect");
    let hasFace = false;

    return {
      setFace(face: HTMLCanvasElement) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face);
        hasFace = true;
      },
      draw(progress: number, dpr: number) {
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (progress <= 0 || !hasFace) return;
        gl.uniform1f(uProgress, progress);
        gl.uniform1f(uAspect, w / h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose() {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  } catch (err) {
    console.warn("frost shader unavailable", err);
    return null;
  }
}
