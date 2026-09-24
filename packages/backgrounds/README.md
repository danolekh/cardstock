# @danolekh/cardstock-backgrounds

Card backgrounds for [@danolekh/cardstock](https://cardstock.danolekh.com), on demand. One CLI to:

- **add** the house artwork (guilloché, holo foil, aurora, topo and more) and the live shader backgrounds (singularity, silk, liquid metal and more, with their posters) to your app: the images go into your public folder, each checked against its SHA-256, and the backgrounds go into a presets file you import;
- **build** your own images into card backgrounds: cropped to the card's ratio at 1720×1080 and 860×540, encoded as WebP or AVIF, with their placeholder colour, tone and a legible ink worked out for you.

The artwork stays out of your bundle and out of `node_modules` until you ask for it, and once added it's yours: plain files and plain data.

## Quick start

```sh
# What's on offer
npx @danolekh/cardstock-backgrounds list

# Add a few (or --all)
npx @danolekh/cardstock-backgrounds add holo aurora guilloche
# Shaders too: their posters download, and <Shader /> from @danolekh/cardstock/shader draws them live
npx @danolekh/cardstock-backgrounds add silk singularity

# Prerender your own
npx @danolekh/cardstock-backgrounds build art/ocean.jpg --position top
```

Then use them:

```tsx
import { Card } from "@danolekh/cardstock";
import { CARD_BACKGROUNDS } from "@/lib/card-backgrounds";

<Card.Root background={CARD_BACKGROUNDS.holo}>…</Card.Root>;
```

Or install it in the project (`npm i -D @danolekh/cardstock-backgrounds`) and run `cardstock-backgrounds …`.

## Commands

### `list`

Shows the presets a manifest offers, with their tags and download size. `--json` prints the manifest itself. `--manifest <url|path>` reads another one.

### `add <name…>`

Downloads each preset's files, verifies their size and SHA-256, and only then writes them (every file of every preset is checked before the first write, so a failure leaves your folder as it was). Files already there and identical are skipped. Gradients have no files; they go straight into the presets file.

| Flag                 | Default                                                    |                                                               |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `--all`              |                                                            | Every preset in the manifest.                                 |
| `--dir <path>`       | `public/backgrounds`                                       | Where the images are written.                                 |
| `--base <url\|path>` | `--dir` without `public/`, e.g. `/backgrounds`             | The URL the images are served from.                           |
| `--out <file>`       | `src/lib/card-backgrounds.ts` (`lib/…` without `src/`)     | The presets file.                                             |
| `--json`             |                                                            | Write the presets file as JSON (`card-backgrounds.json`).     |
| `--force`            |                                                            | Replace presets already in the file, and files that differ.   |
| `--dry-run`          |                                                            | Show what would change; write nothing.                        |
| `--remote`           |                                                            | Don't download: point the presets at the manifest's own host. |
| `--manifest <src>`   | `https://cardstock.danolekh.com/backgrounds/manifest.json` | The catalogue to read.                                        |

A mistyped name gets a suggestion (`No preset called "hollo"; did you mean "holo"?`).

### `build <image…>`

For each image: crops it to the card's ratio, encodes every width from that one crop, then measures it:

- **color**: the average colour (in linear light), shown while the image loads and under the frost;
- **tone**: light or dark, from that colour's luminance, the same rule cardstock uses;
- **ink**: near-white on dark art, near-black on light, faintly tinted toward the image's dominant hue (OKLCH lightness 0.97 or 0.18, chroma 0.02);
- **contrast**: the ink against the _worst tenth_ of the image (its brightest areas for a light ink, its darkest for a dark one), with a warning under 4.5:1. An average would pass art whose highlights swallow the card number.

It prints one line per image and merges the result into the presets file:

```
ocean: color #1d4a63, tone dark, ink #f0f7fb (6.8:1), ocean.webp 84.2 KB, ocean-860.webp 27.9 KB
```

| Flag              | Default    |                                                                                                                                                 |
| ----------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--name <key>`    | file name  | The preset's key (one image at a time). `My Ocean.jpg` becomes `my-ocean`.                                                                      |
| `--position <p>`  | `centre`   | What stays in view: `centre`, `top`, `bottom`, `left`, `right`, `"30% 60%"`, or `attention` / `entropy` to let sharp find the interesting part. |
| `--sizes <w,w>`   | `1720,860` | Widths to encode; heights follow the card's ratio.                                                                                              |
| `--format <f>`    | `webp`     | `webp` or `avif`.                                                                                                                               |
| `--quality <n>`   | `82`       | Encoder quality, 1–100.                                                                                                                         |
| `--hash`          |            | Name files by content (`ocean.3f9a1c2e.webp`), for immutable caching.                                                                           |
| `--tone`, `--ink` | measured   | Your own values instead.                                                                                                                        |
| `--label <text>`  | Title Case | The name shown in a picker.                                                                                                                     |
| `--credit <text>` |            | Attribution kept with the background.                                                                                                           |

`--dir`, `--base`, `--out`, `--json`, `--force` and `--dry-run` work as for `add`. A key that's already in the presets file needs `--force` to rebuild.

Exit codes: 0 on success, 2 for a usage mistake (unknown name, bad flag), 1 when something else fails (network, a file that won't decode, a checksum mismatch).

## The presets file

```ts
// Card backgrounds, managed by @danolekh/cardstock-backgrounds. Lines between the markers are
// rewritten by key on `add` and `build`; edit values freely, or add your own entries outside them.
import type { CardBackground } from "@danolekh/cardstock";

export const CARD_BACKGROUNDS = {
  // cardstock-backgrounds:start
  holo: {
    type: "image",
    label: "Holo",
    src: "/backgrounds/holo.webp",
    srcSet: "/backgrounds/holo-860.webp 860w, /backgrounds/holo.webp 1720w",
    color: "#c7b5f4",
    tone: "light",
    ink: "#231a3d",
  },
  // cardstock-backgrounds:end
} as const satisfies Record<string, CardBackground & { label: string }>;

export type CardBackgroundName = keyof typeof CARD_BACKGROUNDS;
```

It's your file. The tool only touches entries between the markers, matched by key, and leaves every other byte alone, so comments, your own entries and a formatter's reflowing all survive. Existing keys are kept unless you pass `--force`. Store `CardBackgroundName` in your database and look the background up, or store the background itself as JSON and check it with `parseCardBackground` on the way out.

With `--json` it's a plain JSON object of backgrounds by name instead, for loading at runtime or from another language.

## Serving the images

**From your public folder** (the default): same origin, nothing to configure. The files keep their names across releases, so cache them for a while but not forever, or use `--hash`: a content hash in each name means a changed image gets a new URL, and you can serve the folder with

```
Cache-Control: public, max-age=31536000, immutable
```

**From a CDN or another origin**: pass `--base https://cdn.example.com/backgrounds` and upload `--dir`. `<Frost />` reads the image's pixels into its snapshot, which a browser only allows across origins with CORS, so the CDN must send `Access-Control-Allow-Origin` (`*` is fine for public art). Without it the card still paints; only the frost falls back to the background's colour.

**Hotlinking the house art** (`add --remote`): the images at cardstock.danolekh.com are served with CORS and immutable caching, and never change in place. Fine for prototypes; for production, serve your own copies.

## Programmatic API

```ts
import { addPresets, buildBackground, loadManifest, writePresets } from "@danolekh/cardstock-backgrounds";

const { manifest } = await loadManifest(); // or a URL or path
await addPresets(["holo"], { dir: "public/cards", out: "src/cards.ts" });

const built = await buildBackground("art/ocean.jpg", { position: "attention", hash: true });
console.log(built.background, built.files, built.contrast, built.warnings);
await writePresets("src/cards.ts", { [built.name]: built.background });
```

The manifest format is described by [`manifest.schema.json`](./manifest.schema.json) (`@danolekh/cardstock-backgrounds/manifest.schema.json`): publish one beside your own artwork and point `--manifest` at it.

## License

MIT, code and house artwork alike: the backgrounds at cardstock.danolekh.com are original work, free to use, change and ship in commercial products, no attribution required.
