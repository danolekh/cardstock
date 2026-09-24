/* The frozen state as frosted glass, spreading from the middle of the face out.
 *
 * A port of "Spreading Frost" by dos (shadertoy XddcRr), built on Shadmar's "Frosted Glass II"
 * (MsySzy): sample the face at noise-jittered coordinates, tint it towards ice, and reveal that
 * through a vignette that grows with the freeze, its edge broken up by a coarse "ice spread"
 * noise. A shader can't read the DOM, so the face is first redrawn into a 2D canvas from an
 * untransformed clone (backgrounds, SVGs, text), and that becomes the texture.
 *
 * Each pixel is a pure function of the freeze progress, so a reversal mid-way walks back through
 * the same frames. Without WebGL2, or with `webgl={false}`, a frosted gradient fades instead;
 * browsers cap live WebGL contexts, so cards that aren't in focus should use that. Every WebGL
 * session gets a fresh canvas (a canvas whose context was lost hands it back dead forever), and
 * the gradient stands in until the shader has its first snapshot, so a frozen card never shows
 * bare. Anything marked `data-frost-skip` is left out of the snapshot. */

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

/** Redraws the card face into a canvas: an untransformed clone is laid out off-screen, then each
 * background, SVG and text run is drawn where the browser placed it. */
export async function snapshotFace(
  face: HTMLElement,
  stops: readonly Stop[],
  dpr: number,
): Promise<HTMLCanvasElement | null> {
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
  clone.style.transform = "none";
  clone.style.opacity = "1"; // a face faded out (the reduced-motion flip) still has its content
  clone.querySelectorAll("[data-frost-skip]").forEach((n) => n.remove());
  host.appendChild(clone);
  document.body.appendChild(host);

  type Op =
    | { kind: "box"; x: number; y: number; w: number; h: number; r: number; color: string }
    | { kind: "svg"; x: number; y: number; w: number; h: number; img: HTMLImageElement }
    | {
        kind: "text";
        x: number;
        y: number;
        text: string;
        font: string;
        color: string;
        spacing: string;
      };
  const ops: Op[] = [];
  const loads: Promise<unknown>[] = [];

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
        if (node !== clone && !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor)) {
          const r = node.getBoundingClientRect();
          const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.height / 2);
          ops.push({
            kind: "box",
            x: r.left - origin.left,
            y: r.top - origin.top,
            w: r.width,
            h: r.height,
            r: radius,
            color: cs.backgroundColor,
          });
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

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // The CSS 135deg gradient, exactly: its line runs corner to corner through the centre.
  const a = (135 * Math.PI) / 180;
  const half = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2;
  const [dx, dy] = [Math.sin(a) * half, -Math.cos(a) * half];
  if (stops.length) {
    const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    for (const [color, at] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
  } else ctx.fillStyle = getComputedStyle(face).backgroundColor;
  ctx.fillRect(0, 0, w, h);

  ctx.textBaseline = "middle";
  for (const op of ops) {
    if (op.kind === "box") {
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
      ctx.fill();
    } else if (op.kind === "svg") {
      if (op.img.naturalWidth) ctx.drawImage(op.img, op.x, op.y, op.w, op.h);
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
