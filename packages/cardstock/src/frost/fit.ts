/* Where CSS draws an image in a box, for the frost snapshot: `object-fit` / `object-position` for
 * an <img>, `background-size` / `-position` / `-repeat` for a background layer. Computed values
 * only, which the browser has already reduced to lengths, percentages and keywords. */

export interface Size {
  w: number;
  h: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}

type Length = { px: number } | { pct: number } | "auto";

function parseLength(token: string): Length {
  if (token === "auto") return "auto";
  if (token.endsWith("%")) return { pct: parseFloat(token) / 100 };
  return { px: parseFloat(token) || 0 };
}

/** Splits a comma-separated list of layers, leaving commas inside parentheses alone. */
export function splitLayers(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

/** The URL of a `url(...)` image, or null for anything else (gradients, `none`). */
export function imageUrl(layer: string): string | null {
  const match = /^url\(\s*(['"]?)(.*?)\1\s*\)$/.exec(layer.trim());
  return match?.[2] || null;
}

/** The drawn size of an image: an `object-fit` keyword or a `background-size` value. */
export function fitSize(box: Size, natural: Size, size: string): Size {
  if (size === "fill") return { w: box.w, h: box.h };
  if (size === "none") return natural;
  if (size === "cover" || size === "contain") {
    const pick = size === "cover" ? Math.max : Math.min;
    const scale = pick(box.w / natural.w, box.h / natural.h);
    return { w: natural.w * scale, h: natural.h * scale };
  }
  if (size === "scale-down") {
    const contained = fitSize(box, natural, "contain");
    return contained.w < natural.w ? contained : natural;
  }
  const [a = "auto", b = "auto"] = size.trim().split(/\s+/);
  const resolve = (l: Length, extent: number) => (l === "auto" ? null : "pct" in l ? l.pct * extent : l.px);
  const w = resolve(parseLength(a), box.w);
  const h = resolve(parseLength(b), box.h);
  const ratio = natural.w / natural.h;
  if (w === null && h === null) return natural;
  if (w === null) return { w: h! * ratio, h: h! };
  if (h === null) return { w, h: w / ratio };
  return { w, h };
}

const KEYWORDS: Record<string, string> = {
  left: "0%",
  top: "0%",
  center: "50%",
  right: "100%",
  bottom: "100%",
};

/** Places a drawn size in the box by a two-value position ("50% 50%", "10px 0%", "left top").
 * Anything longer (the four-value form) centres. */
export function place(box: Rect, drawn: Size, position: string): Rect {
  const tokens = position.trim().split(/\s+/);
  const [px, py] = tokens.length === 2 ? tokens.map((t) => KEYWORDS[t] ?? t) : ["50%", "50%"];
  const offset = (token: string | undefined, free: number) => {
    const l = parseLength(token ?? "50%");
    return l === "auto" ? free / 2 : "pct" in l ? l.pct * free : l.px;
  };
  return {
    x: box.x + offset(px, box.w - drawn.w),
    y: box.y + offset(py, box.h - drawn.h),
    w: drawn.w,
    h: drawn.h,
  };
}

/** The ends of a CSS `linear-gradient(<angle>deg, …)` line in a w×h box: through the centre, long
 * enough that the corners land on 0% and 100%. */
export function linearEnds(w: number, h: number, angle: number): [number, number, number, number] {
  const a = (angle * Math.PI) / 180;
  const half = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2;
  const [dx, dy] = [Math.sin(a) * half, -Math.cos(a) * half];
  return [w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy];
}

/** The radius of a CSS `circle farthest-corner` radial gradient centred at (x, y). */
export function farthestCorner(w: number, h: number, x: number, y: number): number {
  return Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
}

const MAX_TILES = 400;

/** The copies of a background image that cover the box under `background-repeat` (`space` and
 * `round` are drawn as `repeat`). */
export function tiles(box: Rect, first: Rect, repeat: string): Rect[] {
  const words = repeat.trim().split(/\s+/);
  const [rx, ry] =
    words[0] === "repeat-x"
      ? ["repeat", "no-repeat"]
      : words[0] === "repeat-y"
        ? ["no-repeat", "repeat"]
        : [words[0], words[1] ?? words[0]];
  const along = (on: boolean, start: number, step: number, from: number, extent: number) => {
    if (!on || step <= 0) return [start];
    let at = start - Math.ceil((start - from) / step) * step;
    const out: number[] = [];
    for (; at < from + extent && out.length < MAX_TILES; at += step) out.push(at);
    return out;
  };
  const xs = along(rx !== "no-repeat", first.x, first.w, box.x, box.w);
  const ys = along(ry !== "no-repeat", first.y, first.h, box.y, box.h);
  return ys.flatMap((y) => xs.map((x) => ({ x, y, w: first.w, h: first.h }))).slice(0, MAX_TILES);
}
