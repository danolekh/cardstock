/* A card's background as data: small, JSON-serializable and validated, so an app can store it per
 * card (a jsonb column, a preset key mapped in code) and hand it to `Card.Root`. The one
 * description gives the paint, the tone the text should contrast with, the placeholder while an
 * image loads, and what <Frost /> draws under the face. */

import type * as React from "react";

/** How the background reads. Text takes the opposite: light text on a `dark` background. */
export type Tone = "dark" | "light";

/** A colour and where it sits along the gradient, 0..1. */
export type ColorStop = readonly [color: string, at: number];

interface BackgroundBase {
  /** How it reads; by default worked out from its colours. Set it for artwork and exotic colours. */
  tone?: Tone;
  /** The text colour that goes with it; by default white on dark, near-black on light. */
  ink?: string;
  /** A name to show in a picker. */
  label?: string;
}

export interface SolidBackground extends BackgroundBase {
  type: "solid";
  color: string;
}
export interface LinearBackground extends BackgroundBase {
  type: "linear";
  stops: readonly ColorStop[];
  /** CSS angle in degrees; 135 by default (top left to bottom right). */
  angle?: number;
}
export interface RadialBackground extends BackgroundBase {
  type: "radial";
  stops: readonly ColorStop[];
  /** The centre, as fractions of the width and height; the middle by default. */
  at?: readonly [x: number, y: number];
}
export interface ImageBackground extends BackgroundBase {
  type: "image";
  src: string;
  /** Other widths of the same image, e.g. `"/bg/holo-860.webp 860w, /bg/holo.webp 1720w"`. */
  srcSet?: string;
  /** Which part stays in view when the card's ratio differs (CSS `object-position`). */
  position?: string;
  /** Its dominant colour: shown while it loads or if it fails, and under the frost. */
  color: string;
  /** Attribution, for artwork that asks for it. */
  credit?: string;
}

/** A parameter's value: a number, a colour (hex or rgb()), or a short list of either. */
export type ShaderParamValue = number | string | readonly number[] | readonly string[];

export interface ShaderBackground extends BackgroundBase {
  type: "shader";
  /** Which shader: a built-in id (`"silk"`), or your own namespaced one (`"acme/tide"`) registered
   * with <ShaderLibrary>. The GLSL itself never travels in the data. */
  shader: string;
  /** Its parameters, by name. Unknown names are ignored and values are clamped when it renders. */
  params?: Readonly<Record<string, ShaderParamValue>>;
  /** How fast its time runs, 0..4; 1 by default. */
  speed?: number;
  /** Its dominant colour: shown until the first frame (and without WebGL), and under the frost. */
  color: string;
  /** A still of it, shown until the first frame and whenever it can't render. */
  poster?: string;
  /** Other widths of the poster. */
  posterSrcSet?: string;
  /** Which part of the poster stays in view (CSS `object-position`). */
  position?: string;
  /** Attribution, for shaders that ask for it. */
  credit?: string;
}

export type CardBackground =
  | SolidBackground
  | LinearBackground
  | RadialBackground
  | ImageBackground
  | ShaderBackground;

/** The shaders that ship with `@danolekh/cardstock/shader`. */
export const BUILT_IN_SHADERS: readonly [
  "singularity",
  "silk",
  "mesh",
  "grain",
  "liquid-metal",
  "holo-foil",
  "flow-dots",
  "guilloche",
] = ["singularity", "silk", "mesh", "grain", "liquid-metal", "holo-foil", "flow-dots", "guilloche"];
export type BuiltInShader = (typeof BUILT_IN_SHADERS)[number];

/** Each built-in shader's parameters. The ranges and defaults live with the shader; see the docs. */
export interface ShaderParamsById {
  singularity: { zoom?: number; hue?: number };
  silk: { colors?: readonly string[]; turbulence?: number; scale?: number };
  mesh: { colors?: readonly string[]; distortion?: number; swirl?: number; grain?: number };
  grain: { colors?: readonly string[]; softness?: number; noise?: number };
  "liquid-metal": { tint?: string; bands?: number; distortion?: number };
  "holo-foil": { base?: string; intensity?: number; bands?: number };
  "flow-dots": { dot?: string; spacing?: number; drift?: number };
  guilloche: { ink?: string; lines?: number; petals?: number };
}

/** A built-in shader background, with its parameters type-checked. Pure data: safe on a server. */
export function shaderBackground<K extends BuiltInShader>(
  shader: K,
  init: Omit<ShaderBackground, "type" | "shader" | "params"> & { params?: ShaderParamsById[K] },
): ShaderBackground {
  return { type: "shader", shader, ...init } as ShaderBackground;
}

const MAX_STOPS = 8;
// Hex, a colour function of plain numbers, or a keyword. No url(), var() or anything that could
// close the declaration.
const COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([\w\s.,%+\-/]*\)|[a-z]+)$/i;
const URL_PATTERN = /^(?:https:\/\/|\/(?!\/))[^\s"'()\\<>]*$/i;
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|avif|gif);base64,[a-z0-9+/=]+$/i;
const POSITION = /^[a-z0-9\s.%-]{1,40}$/i;
const SHADER_ID = /^[a-z0-9][a-z0-9-]{0,63}(?:\/[a-z0-9][a-z0-9-]{0,63})?$/;
const PARAM_NAME = /^[a-zA-Z]\w{0,31}$/;
const MAX_PARAMS = 16;
const MAX_PARAM_ITEMS = 8;

const isColor = (v: unknown): v is string => typeof v === "string" && v.length <= 64 && COLOR.test(v.trim());
const isUrl = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 2048 && (URL_PATTERN.test(v) || DATA_IMAGE.test(v));
const isFraction = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;
const isSrcSet = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 4096 &&
  v.split(",").every((candidate) => {
    const [url, descriptor, ...rest] = candidate.trim().split(/\s+/);
    return (
      URL_PATTERN.test(url ?? "") &&
      rest.length === 0 &&
      (!descriptor || /^\d+(?:\.\d+)?[wx]$/.test(descriptor))
    );
  });

const isParamNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e4;
// A shader colour becomes a vec3, so it must be something parseRgb reads.
const isParamColor = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 64 && parseRgb(v) !== null;

function parseParams(v: unknown): Record<string, ShaderParamValue> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const entries = Object.entries(v);
  if (entries.length > MAX_PARAMS) return null;
  const params: Record<string, ShaderParamValue> = {};
  for (const [name, value] of entries) {
    if (!PARAM_NAME.test(name)) return null;
    if (isParamNumber(value) || isParamColor(value)) params[name] = value;
    else if (Array.isArray(value) && value.length >= 1 && value.length <= MAX_PARAM_ITEMS) {
      if (value.every(isParamNumber)) params[name] = [...value];
      else if (value.every(isParamColor)) params[name] = [...value];
      else return null;
    } else return null;
  }
  return params;
}

function parseStops(v: unknown): ColorStop[] | null {
  if (!Array.isArray(v) || v.length < 2 || v.length > MAX_STOPS) return null;
  const stops: ColorStop[] = [];
  for (const stop of v) {
    if (!Array.isArray(stop) || stop.length !== 2 || !isColor(stop[0]) || !isFraction(stop[1])) return null;
    stops.push([stop[0], stop[1]]);
  }
  return stops;
}

/** Checks a background read from storage or from a user, and returns a clean copy (unknown keys
 * dropped) or null. Colours must be plain colours; images must be https:, root-relative or a
 * base64 data: image. Use it on every read from your database. */
export function parseCardBackground(input: unknown): CardBackground | null {
  if (typeof input !== "object" || input === null) return null;
  const v = input as Record<string, unknown>;
  const base: BackgroundBase = {};
  if (v.tone !== undefined) {
    if (v.tone !== "dark" && v.tone !== "light") return null;
    base.tone = v.tone;
  }
  if (v.ink !== undefined) {
    if (!isColor(v.ink)) return null;
    base.ink = v.ink;
  }
  if (v.label !== undefined) {
    if (typeof v.label !== "string" || v.label.length > 80) return null;
    base.label = v.label;
  }
  switch (v.type) {
    case "solid":
      return isColor(v.color) ? { type: "solid", color: v.color, ...base } : null;
    case "linear": {
      const stops = parseStops(v.stops);
      if (!stops) return null;
      if (v.angle === undefined) return { type: "linear", stops, ...base };
      if (typeof v.angle !== "number" || !Number.isFinite(v.angle)) return null;
      return { type: "linear", stops, angle: v.angle, ...base };
    }
    case "radial": {
      const stops = parseStops(v.stops);
      if (!stops) return null;
      if (v.at === undefined) return { type: "radial", stops, ...base };
      if (!Array.isArray(v.at) || v.at.length !== 2 || !isFraction(v.at[0]) || !isFraction(v.at[1]))
        return null;
      return { type: "radial", stops, at: [v.at[0], v.at[1]], ...base };
    }
    case "image": {
      if (!isUrl(v.src) || !isColor(v.color)) return null;
      const image: ImageBackground = { type: "image", src: v.src, color: v.color, ...base };
      if (v.srcSet !== undefined) {
        if (!isSrcSet(v.srcSet)) return null;
        image.srcSet = v.srcSet;
      }
      if (v.position !== undefined) {
        if (typeof v.position !== "string" || !POSITION.test(v.position)) return null;
        image.position = v.position;
      }
      if (v.credit !== undefined) {
        if (typeof v.credit !== "string" || v.credit.length > 200) return null;
        image.credit = v.credit;
      }
      return image;
    }
    case "shader": {
      if (typeof v.shader !== "string" || !SHADER_ID.test(v.shader) || !isColor(v.color)) return null;
      const shader: ShaderBackground = { type: "shader", shader: v.shader, color: v.color, ...base };
      if (v.params !== undefined) {
        const params = parseParams(v.params);
        if (!params) return null;
        shader.params = params;
      }
      if (v.speed !== undefined) {
        if (typeof v.speed !== "number" || !(v.speed >= 0 && v.speed <= 4)) return null;
        shader.speed = v.speed;
      }
      if (v.poster !== undefined) {
        if (!isUrl(v.poster)) return null;
        shader.poster = v.poster;
      }
      if (v.posterSrcSet !== undefined) {
        if (!isSrcSet(v.posterSrcSet)) return null;
        shader.posterSrcSet = v.posterSrcSet;
      }
      if (v.position !== undefined) {
        if (typeof v.position !== "string" || !POSITION.test(v.position)) return null;
        shader.position = v.position;
      }
      if (v.credit !== undefined) {
        if (typeof v.credit !== "string" || v.credit.length > 200) return null;
        shader.credit = v.credit;
      }
      return shader;
    }
    default:
      return null;
  }
}

/** sRGB channels 0..255 of a hex or rgb() colour; null for anything else. */
export function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c)?.[1];
  if (hex && (hex.length === 3 || hex.length === 4)) {
    return [0, 1, 2].map((i) => parseInt(hex[i]! + hex[i]!, 16)) as [number, number, number];
  }
  if (hex && (hex.length === 6 || hex.length === 8)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  const fn = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/i.exec(c);
  if (!fn) return null;
  return [fn[1]!, fn[2]!, fn[3]!].map((ch) =>
    ch.endsWith("%") ? (parseFloat(ch) / 100) * 255 : parseFloat(ch),
  ) as [number, number, number];
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Above this luminance near-black text has more contrast than white.
const CROSSOVER = 0.179;

const colorsOf = (bg: CardBackground): readonly string[] =>
  bg.type === "linear" || bg.type === "radial" ? bg.stops.map(([c]) => c) : [bg.color];

/** How the background reads: its `tone`, else the luminance of its colours (averaged over a
 * gradient's stops). Colours other than hex and rgb() can't be measured and count as dark. */
export function backgroundTone(bg: CardBackground): Tone {
  if (bg.tone) return bg.tone;
  const measured = colorsOf(bg).flatMap((c) => {
    const rgb = parseRgb(c);
    return rgb ? [luminance(rgb)] : [];
  });
  if (!measured.length) return "dark";
  const mean = measured.reduce((a, b) => a + b, 0) / measured.length;
  return mean > CROSSOVER ? "light" : "dark";
}

/** The text colour for the background: its `ink`, else white on dark and near-black on light. */
export function backgroundInk(bg: CardBackground): string {
  return bg.ink ?? (backgroundTone(bg) === "dark" ? "#ffffff" : "#16150f");
}

const stopList = (stops: readonly ColorStop[]) =>
  stops.map(([color, at]) => `${color} ${Math.round(at * 1000) / 10}%`).join(", ");

/** The CSS that paints it. An image is drawn by `Card.Background`'s <img>, and a shader by
 * <Shader /> over its poster; this gives the colour underneath, for while they load. */
export function backgroundStyle(bg: CardBackground): React.CSSProperties {
  switch (bg.type) {
    case "solid":
      return { backgroundColor: bg.color };
    case "linear":
      return { backgroundImage: `linear-gradient(${bg.angle ?? 135}deg, ${stopList(bg.stops)})` };
    case "radial": {
      const [x, y] = bg.at ?? [0.5, 0.5];
      return {
        backgroundImage: `radial-gradient(circle farthest-corner at ${x * 100}% ${y * 100}%, ${stopList(bg.stops)})`,
      };
    }
    case "image":
    case "shader":
      return { backgroundColor: bg.color };
  }
}

/** What the frost snapshot paints under the face before drawing its content. */
export type FrostBase =
  | { kind: "solid"; color: string }
  | { kind: "linear"; angle: number; stops: readonly ColorStop[] }
  | { kind: "radial"; at: readonly [number, number]; stops: readonly ColorStop[] };

/** The frost's base for a background. An image's own pixels come from its <img>, a shader's from
 * its canvas. */
export function frostBase(bg: CardBackground): FrostBase {
  switch (bg.type) {
    case "linear":
      return { kind: "linear", angle: bg.angle ?? 135, stops: bg.stops };
    case "radial":
      return { kind: "radial", at: bg.at ?? [0.5, 0.5], stops: bg.stops };
    default:
      return { kind: "solid", color: bg.color };
  }
}
