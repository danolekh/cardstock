/* Renders cardstock's card backgrounds: original artwork, drawn here as SVG and CSS, rendered by
 * headless Chrome and encoded with cwebp into public/backgrounds at the card's ratio (1.586), at
 * 1720×1080 and 860×540. Every composition is deterministic, so a rerun reproduces the files.
 *
 *   pnpm --filter docs backgrounds [name…]
 *
 * Needs Google Chrome (or CHROME=/path/to/chrome) and cwebp (`brew install webp`). */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const W = 1720;
const H = 1080;
const OUT = new URL("../public/backgrounds/", import.meta.url).pathname;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** A small seeded generator (mulberry32), so the artwork is the same on every run. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;
const polyline = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("");

/** Film grain over everything, so gradients don't band and flat areas feel printed. */
const grain = (opacity: number, frequency = 0.85) => `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="7" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="${opacity}" style="mix-blend-mode:overlay"/>`;

/** Grain for the HTML compositions: the blend sits on the wrapper, so it reaches the layers below
 * (inside the SVG it would only blend with the SVG's own empty backdrop). */
const grainLayer = (opacity: number, frequency = 0.85) =>
  `<div class="fill" style="mix-blend-mode:overlay;opacity:${opacity}">${svg(`
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="${W}" height="${H}" filter="url(#grain)"/>`)}</div>`;

const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;

const page = (content: string, css = "") => `<!doctype html><html><head><style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  .fill{position:absolute;inset:0}
  .blob{position:absolute;border-radius:50%}
  ${css}
</style></head><body><div class="fill">${content}</div></body></html>`;

// Guilloché: the engraved rosettes and waves of bank notes. Rings of a circle whose radius
// ripples, each drawn several times a step out of phase, weave into a mesh.
function guilloche(ground: [string, string, string], line: string, alpha: number) {
  const [cx, cy] = [W * 0.7, H * 0.52];
  const paths: string[] = [];
  // A braided band: the same rippling circle drawn out of phase a few times. The ripple breathes
  // around the ring, and neighbouring bands just touch, like the rope borders on a bank note.
  const ring = (radius: number, amp: number, lobes: number, phase: number, k: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 1440; i++) {
      const t = (i / 1440) * Math.PI * 2;
      const r = radius + amp * (1 + 0.28 * Math.sin(3 * t + k)) * Math.sin(lobes * t + phase);
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return polyline(pts);
  };
  for (let k = 0; k < 8; k++)
    for (let j = 0; j < 6; j++) paths.push(ring(150 + k * 92, 40, 18 + k * 8, (j / 6) * Math.PI * 2, k));
  // A rosette at the heart: an epitrochoid, the spirograph curve.
  const rosette: [number, number][] = [];
  const [a, b, c] = [70, 11, 58];
  for (let i = 0; i <= 4000; i++) {
    const t = (i / 4000) * Math.PI * 2 * b;
    rosette.push([
      cx + (a + b) * Math.cos(t) - c * Math.cos(((a + b) / b) * t),
      cy + (a + b) * Math.sin(t) - c * Math.sin(((a + b) / b) * t),
    ]);
  }
  // Wave lines across the whole note, bending as they pass the rosette.
  const waves: string[] = [];
  for (let k = 0; k < 46; k++) {
    const y0 = (k / 45) * H;
    const pts: [number, number][] = [];
    for (let x = 0; x <= W; x += 8) {
      const d = Math.hypot(x - cx, y0 - cy) / 700;
      pts.push([x, y0 + 16 * Math.sin(x / 70 + k * 0.45) * Math.exp(-d * d) + 6 * Math.sin(x / 190 + k)]);
    }
    waves.push(polyline(pts));
  }
  const defs = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ground[0]}"/><stop offset="0.55" stop-color="${ground[1]}"/><stop offset="1" stop-color="${ground[2]}"/></linearGradient>
    <radialGradient id="fade" cx="${cx / W}" cy="${cy / H}" r="0.75"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0.25"/></radialGradient>
    <mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`;
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#g)"/>
     <g fill="none" stroke="${line}" mask="url(#m)">
       <path d="${waves.join("")}" stroke-width="1.1" opacity="${alpha * 0.55}"/>
       <path d="${paths.join("")}" stroke-width="1.1" opacity="${alpha * 0.8}"/>
       <path d="${polyline(rosette)}" stroke-width="1.4" opacity="${alpha * 1.3}"/>
     </g>`,
    defs,
  );
}

function mesh(
  ground: string,
  blobs: [string, number, number, number, number][],
  blur: number,
  grainOpacity: number,
) {
  const divs = blobs
    .map(
      ([color, x, y, w, h]) =>
        `<div class="blob" style="background:${color};left:${x * W - (w * W) / 2}px;top:${y * H - (h * H) / 2}px;width:${w * W}px;height:${h * H}px"></div>`,
    )
    .join("");
  return page(
    `<div class="fill" style="background:${ground}"></div>
     <div class="fill" style="filter:blur(${blur}px)">${divs}</div>
     ${grainLayer(grainOpacity)}`,
  );
}

// Contour lines of a made-up landscape, traced with marching squares.
function topo() {
  const rnd = random(11);
  const bumps = Array.from({ length: 9 }, () => ({
    x: rnd() * W,
    y: rnd() * H,
    r: 180 + rnd() * 420,
    h: (rnd() - 0.35) * 2,
  }));
  const height = (x: number, y: number) =>
    bumps.reduce((s, b) => s + b.h * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.r * b.r)), 0) +
    0.18 * Math.sin(x / 140 + Math.cos(y / 230) * 2) +
    0.12 * Math.cos(y / 110 - x / 400);
  const step = 6;
  const cols = Math.ceil(W / step) + 1;
  const rows = Math.ceil(H / step) + 1;
  const grid = Array.from({ length: rows }, (_row, j) =>
    Array.from({ length: cols }, (_col, i) => height(i * step, j * step)),
  );
  const flat = grid.flat();
  const [lo, hi] = [Math.min(...flat), Math.max(...flat)];
  const layers: { d: string; major: boolean }[] = [];
  const levels = 30;
  for (let l = 1; l < levels; l++) {
    const iso = lo + ((hi - lo) * l) / levels;
    let d = "";
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const v = [grid[j]![i]!, grid[j]![i + 1]!, grid[j + 1]![i + 1]!, grid[j + 1]![i]!];
        const corners: [number, number][] = [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ];
        const cross: [number, number][] = [];
        for (let e = 0; e < 4; e++) {
          const [a, b] = [v[e]!, v[(e + 1) % 4]!];
          if (a < iso !== b < iso) {
            const t = (iso - a) / (b - a);
            const [p, q] = [corners[e]!, corners[(e + 1) % 4]!];
            cross.push([(p[0] + (q[0] - p[0]) * t) * step, (p[1] + (q[1] - p[1]) * t) * step]);
          }
        }
        for (let k = 0; k + 1 < cross.length; k += 2)
          d += `M${f(cross[k]![0])} ${f(cross[k]![1])}L${f(cross[k + 1]![0])} ${f(cross[k + 1]![1])}`;
      }
    layers.push({ d, major: l % 5 === 0 });
  }
  const defs = `<radialGradient id="g" cx="0.3" cy="0.25" r="1"><stop offset="0" stop-color="#2b3a3f"/><stop offset="1" stop-color="#0d1417"/></radialGradient>`;
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#g)"/>
     <g fill="none" stroke="#cfe3dc" stroke-linecap="round">
       ${layers.map((l) => `<path d="${l.d}" stroke-width="${l.major ? 2.2 : 1.1}" opacity="${l.major ? 0.5 : 0.26}"/>`).join("")}
     </g>${grain(0.3)}`,
    defs,
  );
}

function tide() {
  const rnd = random(23);
  // Deep water throughout: light text sits on every band, the bottom one included.
  const shades = [
    "#08212e",
    "#0b2d3c",
    "#0e394a",
    "#124757",
    "#165663",
    "#1b6570",
    "#20747c",
    "#268389",
    "#2d9294",
  ];
  const bands = shades.map((color, k) => {
    const base = 120 + k * 112;
    const [a1, a2, p1, p2] = [30 + rnd() * 30, 12 + rnd() * 14, rnd() * 6, rnd() * 6];
    const pts: [number, number][] = [];
    for (let x = 0; x <= W; x += 10)
      pts.push([x, base + a1 * Math.sin(x / 260 + p1) + a2 * Math.sin(x / 95 + p2 + k)]);
    return `<path d="${polyline(pts)}L${W} ${H}L0 ${H}Z" fill="${color}"/>`;
  });
  return svg(`<rect width="${W}" height="${H}" fill="#07202d"/>${bands.join("")}${grain(0.3)}`);
}

// Laid paper: a warm sheet with loose fibres and a faint laid line, like a letterpress stock.
function linen() {
  const rnd = random(5);
  const fibres: string[] = [];
  for (let k = 0; k < 1400; k++) {
    let [x, y] = [rnd() * W, rnd() * H];
    let a = rnd() * Math.PI * 2;
    const pts: [number, number][] = [[x, y]];
    const length = 6 + rnd() * 22;
    for (let i = 0; i < length; i++) {
      a += (rnd() - 0.5) * 0.5;
      x += Math.cos(a) * 3;
      y += Math.sin(a) * 3;
      pts.push([x, y]);
    }
    fibres.push(`<path d="${polyline(pts)}" opacity="${f(0.06 + rnd() * 0.12)}"/>`);
  }
  const laid: string[] = [];
  for (let y = 0; y <= H; y += 9) laid.push(`M0 ${y}H${W}`);
  const defs = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf8f2"/><stop offset="0.6" stop-color="#f1ebdf"/><stop offset="1" stop-color="#e6ddcb"/></linearGradient>`;
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#g)"/>
     <path d="${laid.join("")}" stroke="#8a7a5c" stroke-width="1" opacity="0.05"/>
     <g fill="none" stroke="#7d6c4e" stroke-width="1.2" stroke-linecap="round">${fibres.join("")}</g>${grain(0.3)}`,
    defs,
  );
}

function noir() {
  const lines: string[] = [];
  for (let x = 0; x <= W; x += 43) lines.push(`M${x} 0V${H}`);
  for (let y = 0; y <= H; y += 43) lines.push(`M0 ${y}H${W}`);
  const defs = `<radialGradient id="glow" cx="0.78" cy="0.2" r="0.7"><stop offset="0" stop-color="#3a3f52"/><stop offset="1" stop-color="#0a0a0c"/></radialGradient>
    <radialGradient id="fade" cx="0.78" cy="0.2" r="0.9"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`;
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#glow)"/>
     <path d="${lines.join("")}" stroke="#c9cfe6" stroke-width="1" opacity="0.16" mask="url(#m)"/>${grain(0.35)}`,
    defs,
  );
}

const COMPOSITIONS: Record<string, () => string> = {
  guilloche: () => page(guilloche(["#1d2430", "#10151d", "#07090d"], "#e3c98a", 0.42)),
  "guilloche-sand": () => page(guilloche(["#f4ecdc", "#e9ddc4", "#d9c9a8"], "#5b4a2c", 0.36)),
  holo: () =>
    page(
      `<div class="fill" style="filter:blur(60px);transform:scale(1.15)">
         <div class="fill" style="background:conic-gradient(from 200deg at 115% -25%, #ffc1ec, #b9a8ff, #8fe3ff, #a8ffd6, #fff1a8, #ffb8b8, #ffc1ec, #b9a8ff)"></div>
         <div class="blob" style="background:#ff8fd2;left:-160px;top:560px;width:980px;height:700px;opacity:.7"></div>
         <div class="blob" style="background:#6fd2ff;left:900px;top:-300px;width:1000px;height:760px;opacity:.65"></div>
         <div class="blob" style="background:#a996ff;left:560px;top:380px;width:820px;height:640px;opacity:.55"></div>
       </div>
       <div class="fill" style="background:linear-gradient(115deg, transparent 30%, rgb(255 255 255 / .55) 46%, transparent 58%, transparent 66%, rgb(255 255 255 / .3) 74%, transparent 84%);mix-blend-mode:soft-light"></div>
       ${grainLayer(0.35)}`,
    ),
  aurora: () =>
    mesh(
      "#050b1a",
      [
        ["#0a9c7c", 0.28, 0.72, 0.62, 0.42],
        ["#1f7bff", 0.58, 0.3, 0.7, 0.5],
        ["#8a3dff", 0.9, 0.62, 0.52, 0.6],
        ["#0b2a6b", 0.1, 0.15, 0.5, 0.5],
      ],
      130,
      0.4,
    ),
  dusk: () =>
    mesh(
      "#2a0f2e",
      [
        ["#e2582c", 0.2, 0.85, 0.7, 0.6],
        ["#d93a68", 0.55, 0.55, 0.6, 0.55],
        ["#f08a45", 0.05, 0.35, 0.4, 0.5],
        ["#6b2a8f", 0.88, 0.2, 0.6, 0.6],
      ],
      140,
      0.4,
    ),
  topo: () => page(topo()),
  steel: () =>
    page(
      `<div class="fill" style="background:linear-gradient(135deg, #e9edf1, #b7bfc8 38%, #eef1f4 55%, #9ea7b1 80%, #cfd5db)"></div>
       <div class="fill" style="mix-blend-mode:overlay;opacity:.6">${svg(
         `<filter id="brush" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0015 0.9" numOctaves="3" seed="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="${W}" height="${H}" filter="url(#brush)"/>`,
       )}</div>
       ${grainLayer(0.15)}`,
    ),
  linen: () => page(linen()),
  tide: () => page(tide()),
  noir: () => page(noir()),
};

// Fine line art costs a lossy encoder more; it holds up at a lower quality.
const QUALITY: Record<string, number> = { guilloche: 74, "guilloche-sand": 74 };

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COMPOSITIONS);
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "cardstock-bg-"));
try {
  for (const name of names) {
    const compose = COMPOSITIONS[name];
    if (!compose) throw new Error(`No background called "${name}".`);
    const html = join(work, `${name}.html`);
    const png = join(work, `${name}.png`);
    writeFileSync(html, compose());
    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--window-size=${W},${H}`,
        "--virtual-time-budget=2000",
        `--screenshot=${png}`,
        `file://${html}`,
      ],
      { stdio: "ignore" },
    );
    const q = QUALITY[name] ?? 86;
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      String(q),
      "-m",
      "6",
      "-sharp_yuv",
      png,
      "-o",
      join(OUT, `${name}.webp`),
    ]);
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      String(q - 2),
      "-m",
      "6",
      "-sharp_yuv",
      "-resize",
      String(W / 2),
      String(H / 2),
      png,
      "-o",
      join(OUT, `${name}-860.webp`),
    ]);
    console.log(`backgrounds/${name}.webp`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
