import {
  type BuiltInShader,
  type CardBackground,
  type ImageBackground,
  shaderBackground,
  type ShaderBackground,
} from "@danolekh/cardstock/background";

import POSTERS from "./shader-posters.json" with { type: "json" };

/* The docs' own set of backgrounds: the four gradients, the house artwork in public/backgrounds and
 * the built-in shaders. It's the one source for the demos, the promo stage and the manifest the
 * `@danolekh/cardstock-backgrounds` CLI downloads from (scripts/manifest.ts). Apps don't import
 * this: they run `npx @danolekh/cardstock-backgrounds add …` and get their own copy. */

// Served by this site, so the frost can draw them without CORS.
const HOST = "/backgrounds";

const art = (name: string, rest: Omit<ImageBackground, "type" | "src" | "srcSet"> & { label: string }) =>
  ({
    type: "image",
    src: `${HOST}/${name}.webp`,
    srcSet: `${HOST}/${name}-860.webp 860w, ${HOST}/${name}.webp 1720w`,
    ...rest,
  }) as const;

/** A built-in shader with its poster, colour, tone and ink as scripts/shaders.ts measured them. */
const live = (id: BuiltInShader, label: string): ShaderBackground & { label: string } => {
  const poster = (POSTERS as Record<string, Omit<ShaderBackground, "type" | "shader">>)[id];
  if (!poster) throw new Error(`No poster for the "${id}" shader: run pnpm --filter docs shaders ${id}.`);
  return { ...shaderBackground(id, { ...poster }), label };
};

/** The built-in shaders, as backgrounds. */
export const SHADERS = {
  singularity: live("singularity", "Singularity"),
  silk: live("silk", "Silk"),
  mesh: live("mesh", "Mesh"),
  grain: live("grain", "Grain"),
  "liquid-metal": live("liquid-metal", "Liquid metal"),
  "holo-foil": live("holo-foil", "Holo foil"),
  "flow-dots": live("flow-dots", "Flow dots"),
  "guilloche-live": live("guilloche", "Guilloché live"),
} as const satisfies Record<string, ShaderBackground & { label: string }>;

export const BACKGROUNDS = {
  ink: {
    type: "linear",
    label: "Ink",
    stops: [
      ["#34322d", 0],
      ["#171614", 0.55],
      ["#080807", 1],
    ],
    ink: "#f1dfa6",
  },
  paper: {
    type: "linear",
    label: "Paper",
    stops: [
      ["#fbf8f1", 0],
      ["#efe8d8", 0.6],
      ["#e2d8c3", 1],
    ],
    ink: "#1c1a17",
  },
  sage: {
    type: "linear",
    label: "Sage",
    stops: [
      ["#7f9b84", 0],
      ["#566f5b", 0.55],
      ["#3a4d3f", 1],
    ],
    ink: "#f4f1e8",
    tone: "dark",
  },
  ember: {
    type: "linear",
    label: "Ember",
    stops: [
      ["#ff8a5c", 0],
      ["#e0512b", 0.5],
      ["#a8321a", 1],
    ],
    ink: "#fff6ee",
    tone: "dark",
  },
  guilloche: art("guilloche", { label: "Guilloché", color: "#10151d", tone: "dark", ink: "#f1dfa6" }),
  "guilloche-sand": art("guilloche-sand", {
    label: "Guilloché sand",
    color: "#e9ddc4",
    tone: "light",
    ink: "#3b301d",
  }),
  holo: art("holo", { label: "Holo", color: "#c7b5f4", tone: "light", ink: "#231a3d" }),
  aurora: art("aurora", { label: "Aurora", color: "#123a7a", tone: "dark", ink: "#f2f7ff" }),
  dusk: art("dusk", { label: "Dusk", color: "#a83a5e", tone: "dark", ink: "#fff4ec" }),
  topo: art("topo", { label: "Topo", color: "#1a2528", tone: "dark", ink: "#e4f1ec" }),
  steel: art("steel", { label: "Steel", color: "#c9d0d7", tone: "light", ink: "#1b2027" }),
  linen: art("linen", { label: "Linen", color: "#f1ebdf", tone: "light", ink: "#2a241a" }),
  tide: art("tide", { label: "Tide", color: "#145060", tone: "dark", ink: "#effbf8" }),
  noir: art("noir", { label: "Noir", color: "#111218", tone: "dark", ink: "#e8e9f0" }),
  ...SHADERS,
} as const satisfies Record<string, CardBackground & { label: string }>;

export type BackgroundName = keyof typeof BACKGROUNDS;

/** The playground's mix: gradients and artwork, in the order they swipe. */
export const PLAYGROUND_BACKGROUNDS = Object.fromEntries(
  (
    [
      "ink",
      "singularity",
      "holo",
      "silk",
      "guilloche",
      "paper",
      "liquid-metal",
      "aurora",
      "topo",
      "ember",
      "guilloche-sand",
    ] as const
  ).map((name) => [name, BACKGROUNDS[name]]),
) as Record<string, CardBackground & { label: string }>;
