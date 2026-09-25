---
name: promo-video
description: Make frame-exact promo and pitch videos of cardstock (the card library in this repo) — for a post on X, a release, or a pitch to a company in its brand's style, including brand-styled live shader backgrounds, in light and dark. Use when asked to record, film, make or update a promo/launch/showcase/pitch video or clip of cardstock or of a page on danolekh.com, to style cards after a company's brand, or to export a video for X or danolekh.com. For publishing it and pitching with it afterwards, see the user-level `showcase` skill.
---

# Promo videos

Videos of cardstock are filmed, not screen-recorded: `apps/promo` renders a **stage** (the docs'
own components on the site's paper), a **take** scripts the mouse and page actions on a
timeline, and the **recorder** steps a virtual clock one frame at a time and screenshots each
frame, so every run is identical, 60fps, with no dropped frames — WebGL shaders included.

| Piece                                                          | File                                           |
| -------------------------------------------------------------- | ---------------------------------------------- |
| Stage scenes (`?scene=…`, `?cards=…`)                          | `apps/promo/stage/stage.tsx`, `stage/<brand>/` |
| Shared stage hooks (`window.__stage`), ready signal            | `apps/promo/stage/common.ts`                   |
| Dark mode (reads the theme the recorder stores)                | `apps/promo/stage/index.html`                  |
| Takes (URL, 16:9 view, ready selector, themed, script)         | `apps/promo/record/takes.ts`                   |
| Mouse timeline: `move`, `wait`, `click`, `drag`, `loop`, `do`  | `apps/promo/record/take.ts`                    |
| Virtual clock (rAF, `performance.now`, timers, CSS animations) | `apps/promo/record/clock.js`                   |
| Recorder → `out/<take>[-<theme>].mp4`                          | `apps/promo/record/record.ts`                  |
| Web and X cuts, posters, covers                                | `apps/promo/record/encode.ts`                  |

Worked examples: `stage/raiffeisen/` + take `raiffeisen-library` (a brand pitch, captions, a
shader typed in live, closing card), `v05` (a release tour), and `raiffeisen` (a take that films a
page of danolekh.com rather than the stage).

## Workflow

1. **Storyboard first.** One beat per feature, 3–5s each, 30–45s total. For the whole library:
   the tiers swiping by → tilt and glare → flip → details decoding → freeze over a live shader
   → dragging the limit → your own shader typed in → closing wordmark. Give each beat a short
   caption; captions carry a video on X, where it autoplays muted.

2. **For a pitch, research the brand** (its guidelines page, press releases on its identity, its
   actual cards): the core colour and the supporting ones, the shape motif, the tone. Use their
   colours and motifs; **never their logo, wordmark or name on the card, nor anything shaped like
   their mark** (a yellow square with a black frame reads as Raiffeisen's logo) — the cards say
   "cardstock", and the closing card says "a design concept in X's colours · not affiliated with
   X". A useful rule from bank card systems: the more premium the tier, the more striking the
   pattern.

3. **Brand shaders** go in `stage/<brand>/shaders.ts` with `defineShader` under a `<brand>/…` id,
   registered by the scene's `<ShaderLibrary>` — not in the library itself. Recolour built-in
   presets with `shaderBackground("silk", { params: { colors: [...] } })` too. Iterate by
   looking: render each at card size (380×240) and swatch size in Chromium and read the
   screenshots; keep text legible with the ink you'll use. First drafts tend to be loud:
   thick stripes read as hazard tape, which is wrong for a bank — go sparse, thin, luminous,
   with depth fades. Use `uTilt`/`uPointer` so the light follows the tilt, `uPixelRatio` to size
   patterns in CSS px, and `fwidth` for hairlines. A moiré needs two gratings a few degrees apart
   with the beat drawn explicitly; overlaying two line sets alone just looks like lines.

4. **The scene**: a branch in `Stage()` rendering `stage/<brand>/showcase.tsx`. Reuse the docs'
   `CardSwiper`, `PaymentCard`, `LimitField`. Mark what the take clicks with `data-stage="…"`,
   and expose page actions on `api` (`caption`, `byo`, `end`, …). Call `useReady(...)` so the
   recorder waits for fonts, posters and the first shader frame.
   - Keep the swiper in its own clipped column with a soft mask, or the coverflow's neighbours
     cover the controls.
   - Captions and the closing card go above the cards (`z-40`/`z-50` in an `isolate` main).
   - An invisible overlay (a hidden code panel) needs `pointer-events-none` or it eats clicks.
   - Every hand-set colour needs a `dark:` variant; check the scene in both themes with
     screenshots before recording (`localStorage.theme = "dark"` in an init script).

5. **The take**: add it to `takes` in `record/takes.ts` with a 16:9 `view` (800×450 is the norm),
   `ready: "html[data-ready]"`, and `themed: true` so it can be filmed in light and dark. Measure
   targets with `center(page, selector)`, using a selector that hits the real handle (for the
   limit, the scrub label `[title="Drag sideways to change"]`, not the input); page actions go
   through `take.do(page => page.evaluate(...))`. Start and end the mouse off-frame
   (`view.width + 60`; at `+20` a sliver of the cursor shows on the last frame).
   - To film a page of danolekh.com instead, give the take that URL and `css` that pares the page
     down to the demo, and pass `--url` with the dev server's origin.

6. **Record**, with `pnpm --filter promo stage` running on :4173 (load the scene once in a browser
   first: Vite re-optimising a new dependency on first load gives an "Invalid hook call"):

   ```bash
   pnpm --filter promo record <take> --fast                 # draft: 1920 wide, 60fps, ~5 min
   pnpm --filter promo record <take> [--theme light|dark]   # final: 3840 at 120fps → 1080p60, ~25 min
   ```

   Run finals in the background, light then dark in one command. Don't edit stage files while a
   take records: Vite hot-reloads the page mid-take.

   Check a draft by pulling stills at each beat and looking at them **one by one, or stacked
   vertically**. Side-by-side tiles put one still's edge against the next still's, which looks
   exactly like a card split in half (it cost a false bug hunt once):

   ```bash
   for t in 2 6 10 14 18 22 26 30 34 38; do ffmpeg -loglevel error -y -ss $t -i out/<take>.mp4 -frames:v 1 -vf scale=960:-1 /tmp/beat-$t.png; done
   ```

   Something only in the recording and not in a live screenshot at the recorder's scale is the
   first thing to doubt; reproduce it in a normal browser before changing code.

7. **Encode**:

   ```bash
   pnpm --filter promo encode out/<take>[-<theme>].mp4 <name> --out <dir> [--cover <dir>] [--x]
   ```

   `<name>-1600.mp4` / `-800.mp4` and `-poster.webp` / `-poster-800.webp` for the web;
   `--cover` writes danolekh.com's cover names (`<dir>/<name>.webp`, `-800.webp`); `--x` writes
   `<name>-x.mp4` for X (1920×1080, 60fps, H.264 High, CRF 18, faststart; X allows up to 2:20 and
   512 MB). Move the X cut to `apps/promo/out/` (gitignored); it doesn't belong in a site's public
   folder. Check with
   `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration,size <file>`.
   Naming for theme pairs on danolekh.com: `<name>-dark-*` for dark, plain `<name>-*` (or
   `<name>-light-*`) for light.

8. **Publish** with the `showcase` skill: danolekh.com's post/case-study conventions, both theme
   cuts, the share image, deploy, and the pitch.

## Why frames are exact

`clock.js` replaces `performance.now`, `Date.now`, `Event.timeStamp`, `requestAnimationFrame`
and the timers before any page script runs, and pins CSS animations and transitions to the
virtual time. cardstock's shader loop, frost and carousel all read those, so a shader's `uTime`
advances exactly one frame per screenshot and every card shares the one WebGL context. Headless
Chromium has no cursor, so `cursor.js` draws one (the take's `accent` colours its pressed ring).
For a quick look outside the recorder, Playwright with `channel: "chrome"` renders the shaders on
the GPU; plain headless Chrome with `--screenshot` can come out blank for bitmap-based canvases.
