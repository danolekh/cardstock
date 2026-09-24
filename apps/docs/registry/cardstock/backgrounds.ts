import type { CardBackground, ImageBackground } from "@danolekh/cardstock";

/* cardstock's backgrounds, as data. Each one is a plain `CardBackground` you can pass to
 * `Card.Root`, store (as JSON, or by its key), or copy and change. The images are original
 * artwork hosted at cardstock.danolekh.com with CORS, so the frost can draw them; download them to
 * serve them yourself. */

const HOST = "https://cardstock.danolekh.com/backgrounds";

const art = (name: string, rest: Omit<ImageBackground, "type" | "src" | "srcSet"> & { label: string }) =>
  ({
    type: "image",
    src: `${HOST}/${name}.webp`,
    srcSet: `${HOST}/${name}-860.webp 860w, ${HOST}/${name}.webp 1720w`,
    ...rest,
  }) as const;

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
} as const satisfies Record<string, CardBackground & { label: string }>;

export type BackgroundName = keyof typeof BACKGROUNDS;
