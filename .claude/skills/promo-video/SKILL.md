---
name: promo-video
description: Make frame-exact promo and pitch videos of cardstock (the card library in this repo) — for a post on X, a release, or a pitch to a company in its brand's style, including brand-styled live shader backgrounds. Use when asked to record, film, make or update a promo/launch/showcase/pitch video or clip of cardstock, to style cards after a company's brand for a video, or to export a video for X or danolekh.com.
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
| Takes (URL, 16:9 view, ready selector, script)                 | `apps/promo/record/takes.ts`                   |
| Mouse timeline: `move`, `wait`, `click`, `drag`, `loop`, `do`  | `apps/promo/record/take.ts`                    |
| Virtual clock (rAF, `performance.now`, timers, CSS animations) | `apps/promo/record/clock.js`                   |
| Recorder → `out/<take>.mp4`                                    | `apps/promo/record/record.ts`                  |
| Web and X cuts, posters, covers                                | `apps/promo/record/encode.ts`                  |

The Raiffeisen showcase (`stage/raiffeisen/`, take `raiffeisen-library`) is the worked example of
everything below.

## Workflow

1. **Storyboard first.** One beat per feature, 3–5s each, 30–45s total. For the whole library:
   the tiers swiping by → tilt and glare → flip → details decoding → freeze over a live shader
   → dragging the limit → your own shader typed in → closing wordmark. Give each beat a short
   caption.

2. **For a pitch, research the brand** (its guidelines page, press releases on its identity, its
   actual cards): the core colour and the supporting ones, the shape motif, the tone. Use their
   colours and motifs; **never their logo, wordmark or name on the card** — the cards say
   "cardstock", and the closing card says "a design concept in X's colours · not affiliated with
   X". A useful rule from bank card systems: the more premium the tier, the more striking the
   pattern.

3. **Brand shaders** go in `stage/<brand>/shaders.ts` with `defineShader` under a `<brand>/…` id,
   registered by the scene's `<ShaderLibrary>` — not in the library itself. Recolour built-in
   presets with `shaderBackground("silk", { params: { colors: [...] } })` too. Iterate by
   looking: render each at card size (380×240) and swatch size in Chromium and read the
   screenshots; keep text legible with the ink you'll use; avoid anything that reads as
   hazard tape. Use `uTilt`/`uPointer` so the light follows the tilt, `uPixelRatio` to size
   patterns in CSS px, and `fwidth` for hairlines.

4. **The scene**: a branch in `Stage()` rendering `stage/<brand>/showcase.tsx`. Reuse the docs'
   `CardSwiper`, `PaymentCard`, `LimitField`. Mark what the take clicks with `data-stage="…"`,
   and expose page actions on `api` (`caption`, `byo`, `end`, …). Call `useReady(...)` so the
   recorder waits for fonts, posters and the first shader frame. Keep the swiper in its own
   clipped column, and put captions and the closing card above the cards (`z-40`/`z-50`; live
   shader canvases stack high).

5. **The take**: add it to `takes` in `record/takes.ts` with a 16:9 `view` (800×450 is the norm)
   and `ready: "html[data-ready]"`. Measure targets with `center(page, selector)`; page actions
   go through `take.do(page => page.evaluate(...))`. Start and end the mouse off-frame
   (`view.width + 60`).

6. **Record**, with `pnpm --filter promo stage` running on :4173:

   ```bash
   pnpm --filter promo record <take> --fast   # draft: 1920 wide, 60fps, a few minutes
   pnpm --filter promo record <take>          # final: 3840 wide at 120fps, blended to 1080p60
   ```

   Check a draft by pulling stills at each beat and looking at them:

   ```bash
   for t in 2 6 10 14 18 22 26 30 34 38; do ffmpeg -loglevel error -y -ss $t -i out/<take>.mp4 -frames:v 1 -vf scale=640:-1 /tmp/beat-$t.png; done
   ```

   The first page load can hit Vite re-optimising a new dependency (an "Invalid hook call");
   load the scene once in a browser before recording.

7. **Encode**:

   ```bash
   pnpm --filter promo encode out/<take>.mp4 <name> --out <dir> [--cover <dir>] [--x]
   ```

   `<name>-1600.mp4` / `-800.mp4` and posters for the web; `--cover` writes danolekh.com's
   project-cover names; `--x` writes `<name>-x.mp4` for X (1920×1080, 60fps, H.264 High,
   CRF 18, faststart; X allows up to 2:20 and 512 MB). Check with
   `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration,size <file>`.

8. **Publish**: on danolekh.com (`/Users/dan/code/danolekh`) videos live in `public/videos/`, and
   a post embeds one with a `video` code fence or its `video`/`cover` frontmatter; deploy with
   `pnpm run deploy` there. For X, post `<name>-x.mp4` with one line and the docs link.

## Why frames are exact

`clock.js` replaces `performance.now`, `Date.now`, `Event.timeStamp`, `requestAnimationFrame`
and the timers before any page script runs, and pins CSS animations and transitions to the
virtual time. cardstock's shader loop, frost and carousel all read those, so a shader's `uTime`
advances exactly one frame per screenshot and every card shares the one WebGL context. Headless
Chromium has no cursor, so `cursor.js` draws one (the take's `accent` colours its pressed ring).
