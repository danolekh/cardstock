/* The takes the recorder can film. Each is a page, how to frame it, and the mouse's script. */
import type { Page } from "playwright";

import { linear, type Point, Take } from "./take.ts";

export interface TakeDef {
  /** Page to film; `--url` overrides the origin. */
  url: string;
  /** The frame in CSS px (16:9); the recorder films it at 3840 wide and outputs 1920×1080. */
  view: { width: number; height: number };
  /** The page is ready once this matches. */
  ready: string;
  /** Styles that pare the page down to what's filmed. */
  css?: string;
  /** Films in the site's light or dark theme (`--theme`), stored the way next-themes reads it. */
  themed?: boolean;
  /** The cursor's pressed ring. */
  accent: string;
  script: (page: Page, view: TakeDef["view"]) => Promise<Take>;
}

const center = async (page: Page, selector: string): Promise<Point> => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`nothing matches ${selector}`);
  return [box.x + box.width / 2, box.y + box.height / 2];
};

/** Tilt the first card, swipe to the next and freeze it, tilt it frozen, thaw it, swipe through
 * the rest, then flick back to the first so the video loops. */
function tour([cx, cy]: Point, toggle: Point, cards: number, view: TakeDef["view"]): Take {
  const off: Point = [view.width + 20, view.height - 40];
  const take = new Take(off).wait(300);
  const swipe = () =>
    take
      .move(cx + 90, cy, 350)
      .wait(80)
      .drag(-170, 260)
      .wait(560);

  take.move(cx + 140, cy + 40, 700).loop(cx, cy, 150, 70, 3000);
  swipe();
  take
    .move(...toggle, 650)
    .wait(120)
    .click()
    .wait(900);
  take.move(cx + 110, cy + 30, 700).loop(cx, cy, 120, 55, 2200);
  take
    .move(...toggle, 650)
    .wait(120)
    .click()
    .wait(700);
  for (let i = 2; i < cards; i++) swipe();
  take.wait(200);
  for (let i = 1; i < cards; i++)
    take
      .move(cx - 100, cy, i > 1 ? 170 : 380)
      .wait(30)
      .drag(200, 130, linear)
      .wait(90);
  take
    .wait(900)
    .move(off[0], cy + 120, 600)
    .wait(300);
  return take;
}

/** The 0.4 take: tilt a live shader and rest on its corner, the three flips (the sheen, toward
 * the tap, lift and land), a swipe through shader backgrounds that wake as they reach the middle,
 * and a freeze that brings the shader to a stop under the frost; then back to the start. */
function tour04(
  [cx, cy]: Point,
  toggle: Point,
  cards: number,
  view: TakeDef["view"],
  { aliveUnderFrost = false } = {},
): Take {
  const off: Point = [view.width + 20, view.height - 40];
  const take = new Take(off).wait(300);
  const setFlip = (effect: unknown) => (page: Page) =>
    page.evaluate((e) => (window as any).__stage.setFlip(e), effect);
  const swipe = () =>
    take
      .move(cx + 90, cy, 350)
      .wait(80)
      .drag(-170, 260)
      .wait(720);

  // The foil follows the tilt; then the pointer rests right on the corner, and nothing flickers.
  take.move(cx + 140, cy + 40, 700).loop(cx, cy, 150, 70, 2800);
  take.move(cx + 176, cy - 108, 500).wait(700);
  // The sheen, the default.
  take
    .move(cx + 20, cy + 10, 450)
    .wait(100)
    .click()
    .wait(1050)
    .click()
    .wait(850);
  // Toward the tap: a press near the top turns it over top to bottom.
  take
    .do(setFlip(["toward", "sheen"]))
    .move(cx - 10, cy - 96, 450)
    .wait(120)
    .click()
    .wait(1150);
  take.click().wait(950);
  // Lift and land.
  take
    .do(setFlip(["lift", "sheen"]))
    .move(cx + 30, cy + 20, 400)
    .wait(100)
    .click()
    .wait(1250);
  take.click().wait(1000);
  take.do(setFlip("sheen"));
  // Through the shaders: each wakes as it reaches the middle.
  for (let i = 1; i < cards; i++) swipe();
  take
    .move(...toggle, 600)
    .wait(120)
    .click()
    .wait(1300);
  if (aliveUnderFrost) {
    // 0.5: the shader keeps running under the frost, so tilting the frozen card still moves the
    // metal's reflections beneath the ice.
    take.move(cx + 120, cy + 40, 600).loop(cx, cy, 140, 65, 2800);
  } else {
    // 0.4: the frost spreads, and the shader's time eases to a stop under it.
    take.move(cx + 100, cy + 30, 700).wait(1100);
  }
  take
    .move(...toggle, 600)
    .wait(120)
    .click()
    .wait(900);
  take.wait(150);
  for (let i = 1; i < cards; i++)
    take
      .move(cx - 100, cy, i > 1 ? 170 : 380)
      .wait(30)
      .drag(200, 130, linear)
      .wait(90);
  take
    .wait(900)
    .move(off[0], cy + 120, 600)
    .wait(300);
  return take;
}

/** Your own shader: the twigl source types in, the card comes alive with it, and it leans with the
 * tilt. */
function ownShader([cx, cy]: Point, view: TakeDef["view"]): Take {
  const off: Point = [view.width + 20, view.height - 40];
  const take = new Take(off).wait(400);
  take.do((page) => page.evaluate(() => (window as any).__stage.start()));
  // Typing takes about 1s at a few characters a frame; the card goes live 250ms after.
  take.wait(1500);
  take.move(cx + 120, cy + 40, 700).loop(cx, cy, 130, 60, 3000);
  take.move(off[0], cy + 100, 600).wait(600);
  return take;
}

/** The Raiffeisen showcase (`?scene=raiffeisen`): the whole library in about forty seconds, one
 * beat per caption. Swipe through the six tiers to the premium moiré and tilt it, flip it and back
 * (the shader never stops), decode the details, swipe back to Gold and freeze it (the ribbons keep
 * rising under the frost), drag the limit, type in a brand shader, and close on the wordmark. */
async function showcase(page: Page, view: TakeDef["view"]): Promise<Take> {
  const [cx, cy] = await center(page, "[data-slot=carousel-viewport]");
  const freeze = await center(page, "[data-stage=freeze]");
  const flip = await center(page, "[data-stage=flip]");
  const reveal = await center(page, "[data-stage=reveal]");
  const scrub = await center(page, '[data-stage=limit] [title="Drag sideways to change"]');
  // Far enough out that no edge of the cursor's ring shows.
  const off: Point = [view.width + 60, view.height - 40];
  const take = new Take(off).wait(300);
  const caption = (text: string | null) => (p: Page) =>
    p.evaluate((t) => (window as any).__stage.caption(t), text);
  const stage = (name: "byo" | "end") => (p: Page) => p.evaluate((n) => (window as any).__stage[n](), name);
  const swipe = (dx: number, settle: number) =>
    take
      .move(cx + (dx < 0 ? 90 : -90), cy, 320)
      .wait(60)
      .drag(dx, 240)
      .wait(settle);

  // 1. Six tiers, each a live shader: quiet yellow up to the premium moiré.
  take.do(caption("Six cards, six live shaders, one GPU context")).wait(900);
  for (let i = 0; i < 5; i++) swipe(-170, i === 4 ? 500 : 820);
  // 2. The light follows the tilt.
  take.do(caption("Tilt, glare, and a shader that follows the light"));
  take.move(cx + 140, cy + 40, 600).loop(cx, cy, 150, 70, 3200);
  // 3. The flip, and the shader runs straight through it.
  take.do(caption("Flip it: the shader never stops"));
  take
    .move(...flip, 600)
    .wait(120)
    .click()
    .wait(1400)
    .click()
    .wait(1000);
  // 4. The details decode digit by digit.
  take.do(caption("Details decode, digit by digit"));
  take
    .move(...reveal, 450)
    .wait(120)
    .click()
    .wait(1700)
    .click()
    .wait(700);
  // 5. Back to Gold and freeze it: the frost lays over the running ribbons.
  take.do(caption(null));
  for (let i = 0; i < 4; i++)
    take
      .move(cx - 100, cy, i ? 170 : 380)
      .wait(30)
      .drag(200, 150, linear)
      .wait(i === 3 ? 700 : 110);
  take.do(caption("Freeze: the frost lays over a running shader"));
  take
    .move(...freeze, 600)
    .wait(120)
    .click()
    .wait(1300);
  take.move(cx + 120, cy + 40, 600).loop(cx, cy, 130, 60, 2600);
  take
    .move(...freeze, 600)
    .wait(120)
    .click()
    .wait(900);
  // 6. Spending against a limit you drag.
  take.do(caption("Spending, against a limit you drag"));
  // Three px a step, €50 a step: up to about €1,800, then back a little.
  take
    .move(...scrub, 600)
    .wait(150)
    .drag(40, 1200)
    .wait(300)
    .drag(-12, 600)
    .wait(1000);
  // 7. The brand's own shader, typed in.
  take.do(caption("Your brand’s own GLSL, in one line"));
  take.move(off[0], off[1], 700).do(stage("byo")).wait(1700);
  take.move(cx + 120, cy + 40, 700).loop(cx, cy, 140, 65, 3000);
  // 8. The wordmark.
  take
    .do(caption(null))
    .move(off[0], cy + 120, 600)
    .wait(200)
    .do(stage("end"))
    .wait(3200);
  return take;
}

/** Dan's showreel (`pnpm showreel` in ~/code/danolekh, on :4174): fifteen seconds that run on the
 * page's own timeline from `__stage.start()`. The pointer only comes in for bar 6, circling the
 * cardstock card so its glare follows, and is hidden: the reel is motion graphics, not a screen
 * recording. The take is exactly 15 s, eight bars at 128 BPM. */
function showreel(_page: Page, view: TakeDef["view"]): Take {
  const card: Point = [900, 372];
  const off: Point = [view.width + 60, view.height - 40];
  const take = new Take(off).do((p) => p.evaluate(() => (window as any).__stage.start()));
  take.wait(9700);
  take.move(card[0] + 150, card[1] + 50, 300, linear).loop(card[0], card[1], 160, 70, 1000);
  take.move(off[0], card[1] + 90, 300);
  take.wait(15000 - take.t);
  return take;
}

const DEMO = '[data-demo="raiffeisen-card"]';

const SHADER_CARDS = ["holo-foil", "silk", "singularity", "mesh", "liquid-metal"];


/** Where the lab's price plot draws a dot, from its `cx`/`cy` and the svg's box, so the answer
 * doesn't depend on whether the dots are mid-drop when it's asked. */
const priceDots = (page: Page) =>
  page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>(".pe-plot svg")!;
    const box = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const at = (c: Element): [number, number] => [
      box.left + (Number(c.getAttribute("cx")) / vb.width) * box.width,
      box.top + (Number(c.getAttribute("cy")) / vb.height) * box.height,
    ];
    const dots = [...svg.querySelectorAll(".pe-dot")];
    const band = svg.querySelector(".pe-band")!;
    const bx = Number(band.getAttribute("x"));
    const bw = Number(band.getAttribute("width"));
    // The top dot of the column nearest to a point `f` of the way across the range.
    const topNear = (f: number) => {
      const x = bx + bw * f;
      const cx = dots.map((d) => Number(d.getAttribute("cx")));
      const col = cx.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      const column = dots.filter((d) => Number(d.getAttribute("cx")) === col);
      return at(column.reduce((a, b) => (Number(b.getAttribute("cy")) < Number(a.getAttribute("cy")) ? b : a)));
    };
    const tallest = dots.reduce((a, b) => (Number(b.getAttribute("cy")) < Number(a.getAttribute("cy")) ? b : a));
    const last = dots.reduce((a, b) => (Number(b.getAttribute("cx")) > Number(a.getAttribute("cx")) ? b : a));
    return { tallest: at(tallest), mid: topNear(0.62), edge: topNear(0.95), outlier: at(last) };
  });

/** The lab's Minimist demo from the user's side: take the bag photo from the row, drag it into the
 * card and let go; the photo is read, the listing comes back and its sales drop in. Point at the
 * tallest column and the priciest sale, press "Try another item", and leave the frame while the photo
 * flies home, so the clip ends where it began. The dots only exist once a listing is up, so the flow
 * runs once off camera (the page's clock is still real then) to find them, and is reset. */
async function priceEvidence(page: Page, view: TakeDef["view"], lead = 250, tail = 400): Promise<Take> {
  const bag = await center(page, '[data-item="bag"]');
  const zone = await center(page, "[data-slot=mnm-zone]");
  // Clicked through the DOM, so the mouse never enters the frame and the cursor stays hidden.
  const tap = (selector: string) =>
    page.evaluate((s) => document.querySelector<HTMLElement>(s)!.click(), selector);
  await tap('[data-item="bag"]');
  await page.waitForSelector("[data-slot=price-evidence]");
  await page.waitForTimeout(3600);
  const { tallest, outlier } = await priceDots(page);
  const reset = await center(page, "[data-slot=mnm-reset]");
  await tap("[data-slot=mnm-reset]");
  await page.waitForFunction(() => document.querySelector(".mnm-demo")?.getAttribute("data-phase") === "idle");
  await page.waitForTimeout(900);

  const off: Point = [view.width + 60, view.height * 0.3];
  // The drag bows upward a little, the way a hand carries something.
  const lift: Point = [(bag[0] + zone[0]) / 2 + 40, Math.min(bag[1], zone[1]) - 10];
  const arc = (t: number): Point => {
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const u = 1 - e;
    return [
      u * u * bag[0] + 2 * u * e * lift[0] + e * e * zone[0],
      u * u * bag[1] + 2 * u * e * lift[1] + e * e * zone[1],
    ];
  };
  return new Take(off)
    .wait(lead)
    .move(...bag, 850)
    .press(true)
    .wait(160)
    .path(arc, 950)
    .wait(220)
    .press(false)
    .wait(700)
    // While the photo is read, the hand drifts over to where the listing will be.
    .move((zone[0] + tallest[0]) / 2 + 20, (zone[1] + tallest[1]) / 2 + 30, 1300)
    .wait(2300)
    .move(...tallest, 750)
    .wait(900)
    .move(...outlier, 900)
    .wait(900)
    .move(...reset, 850)
    .wait(200)
    .click()
    .wait(100)
    .move(...off, 800)
    // Past the edge Chrome stops sending moves, so the cursor would stay on the last in-frame one.
    .do((p) => p.evaluate(() => dispatchEvent(new PointerEvent("pointermove", { clientX: 4000, clientY: 0 }))))
    .wait(tail);
}

const LAB = (slug: string) => `[data-demo="${slug}"]`;

/** The lab's glass: the cursor takes the lens by its middle, carries it in a figure-eight over the
 * type, sets it down where it was and leaves. The backdrop is still, so the last frame is the first
 * and the clip loops as it is (no `--loop`). */
async function glass(page: Page, view: TakeDef["view"]): Promise<Take> {
  const lens = await page.locator(`${LAB("glass")} [data-slot=glass-lens]`).boundingBox();
  const stage = await page.locator(`${LAB("glass")} [data-slot=glass-stage]`).boundingBox();
  if (!lens || !stage) throw new Error("no glass lens on the page");
  const [cx, cy]: Point = [lens.x + lens.width / 2, lens.y + lens.height / 2];
  // Kept inside the lens's room, so it never meets the clamp and the loop closes exactly.
  const rx = Math.min(270, (stage.width - lens.width) / 2 - 24);
  const ry = Math.min(95, (stage.height - lens.height) / 2 - 24);
  const off: Point = [view.width + 60, view.height * 0.7];
  return new Take(off)
    .wait(500)
    .move(cx, cy, 900)
    .wait(120)
    .press(true)
    .wait(180)
    .loop(cx, cy, rx, ry, 4800)
    .wait(140)
    .press(false)
    .wait(260)
    .move(...off, 800)
    // Past the edge Chrome stops sending moves, so the cursor would stay on the last in-frame one.
    .do((p) => p.evaluate(() => dispatchEvent(new PointerEvent("pointermove", { clientX: 4000, clientY: 0 }))))
    .wait(500);
}

/** The lines of a block of text as the browser set them, top to bottom, in page px. */
const textLines = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const rows: { l: number; r: number; y: number; h: number }[] = [];
    const walk = document.createTreeWalker(document.querySelector(s)!, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.parentElement?.tagName === "STYLE") continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        const y = r.top + r.height / 2;
        const row = rows.find((q) => Math.abs(q.y - y) < r.height / 3);
        if (row) {
          row.l = Math.min(row.l, r.left);
          row.r = Math.max(row.r, r.right);
        } else rows.push({ l: r.left, r: r.right, y, h: r.height });
      }
    }
    return rows.sort((a, b) => a.y - b.y);
  }, selector);

/** The lab's smear in wild's style: in from the right, a fast sweep back through the middle of the
 * headline, a wait while the ink settles, a slow drift back through it, another wait, and out the
 * way it came, so the clip ends where it began. */
async function smear(page: Page, view: TakeDef["view"]): Promise<Take> {
  const rows = await textLines(page, `${LAB("smear")} [data-slot=smear]`);
  if (rows.length < 2) throw new Error("the headline should run to two lines or more");
  const left = Math.min(...rows.map((r) => r.l));
  const right = Math.max(...rows.map((r) => r.r));
  const i = Math.floor((rows.length - 1) / 2);
  const [a, b] = [rows[i]!, rows[i + 1]!];
  const off: Point = [view.width + 60, rows[0]!.y - rows[0]!.h];
  const start: Point = [right + 48, a.y];
  const end: Point = [left - 48, b.y];
  const home: Point = [right + 48, (a.y + b.y) / 2];
  const sine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
  // Fast: from line a down to line b with a slight belly, at full reach.
  const fast = (t: number): Point => {
    const e = sine(t);
    return [start[0] + (end[0] - start[0]) * e, start[1] + (end[1] - start[1]) * e + Math.sin(Math.PI * e) * b.h * 0.15];
  };
  // Slow: back across, weaving between the two lines, with a little drag.
  const slow = (t: number): Point => {
    const e = sine(t);
    return [end[0] + (home[0] - end[0]) * e, end[1] + (home[1] - end[1]) * e + Math.sin(2 * Math.PI * e) * a.h * 0.35];
  };
  return new Take(off)
    .wait(900)
    .move(...start, 850)
    .wait(250)
    .path(fast, 420)
    // Longer than the smear's settle (900 ms), so the type is crisp again before the slow pass.
    .wait(1500)
    .path(slow, 2400)
    .wait(1400)
    .move(...off, 850)
    // Past the edge Chrome stops sending moves, so the cursor would stay on the last in-frame one.
    .do((p) => p.evaluate(() => dispatchEvent(new PointerEvent("pointermove", { clientX: 4000, clientY: 0 }))))
    .wait(1000);
}

export const takes: Record<string, TakeDef> = {
  showreel: {
    url: "http://localhost:4174/?record",
    view: { width: 1280, height: 720 },
    ready: "html[data-ready]",
    accent: "#3b82f6",
    css: `body > div[style*="2147483647"] { display: none !important; }`,
    script: async (page, view) => showreel(page, view),
  },

  // The library, on cards in Raiffeisen's style, for the pitch: stage/raiffeisen.
  "raiffeisen-library": {
    url: "http://localhost:4173/?scene=raiffeisen",
    view: { width: 800, height: 450 },
    ready: "html[data-ready]",
    themed: true,
    accent: "#fbf315",
    script: showcase,
  },
  // cardstock 0.4 on the stage: shader backgrounds, the new flips, the 2D coverflow.
  v04: {
    url: `http://localhost:4173/?cards=${SHADER_CARDS.join(",")}`,
    view: { width: 800, height: 450 },
    ready: "html[data-ready]",
    accent: "#d9482a",
    script: async (page, view) =>
      tour04(
        await center(page, "[data-slot=carousel-viewport]"),
        await center(page, "[data-stage=freeze]"),
        SHADER_CARDS.length,
        view,
      ),
  },

  // cardstock 0.5: the same tour, with the frozen card's shader alive under the frost.
  v05: {
    url: `http://localhost:4173/?cards=${SHADER_CARDS.join(",")}`,
    view: { width: 800, height: 450 },
    ready: "html[data-ready]",
    themed: true,
    accent: "#d9482a",
    script: async (page, view) =>
      tour04(
        await center(page, "[data-slot=carousel-viewport]"),
        await center(page, "[data-stage=freeze]"),
        SHADER_CARDS.length,
        view,
        { aliveUnderFrost: true },
      ),
  },

  // Bring your own shader: a twigl one-liner becomes a card background.
  byo: {
    url: "http://localhost:4173/?scene=byo",
    view: { width: 800, height: 450 },
    ready: "html[data-ready]",
    accent: "#d9482a",
    script: async (page, view) => ownShader(await center(page, "[data-slot=card-tilt]"), view),
  },

  // The stage in this package (`pnpm stage`): cardstock's swiper on its own paper.
  cardstock: {
    url: "http://localhost:4173/",
    view: { width: 800, height: 450 },
    ready: "html[data-ready]",
    accent: "#d9482a",
    script: async (page, view) =>
      tour(
        await center(page, "[data-slot=carousel-viewport]"),
        await center(page, "[data-stage=freeze]"),
        5,
        view,
      ),
  },

  // The Raiffeisen pitch's own demo on danolekh.com (`pnpm dev` in that repo): the card stage and
  // the freeze row, filling the frame, the rest of the post hidden.
  raiffeisen: {
    url: "http://localhost:3000/b/raiffeisen",
    view: { width: 768, height: 432 },
    ready: `${DEMO} [aria-roledescription=carousel]`,
    themed: true,
    accent: "#1c1a17",
    css: `
      html, body { overflow: hidden !important; }
      ${DEMO} { position: fixed !important; inset: 0 !important; z-index: 2147483000; margin: 0 !important; }
      ${DEMO} > div {
        margin: 0 !important; height: 100%; border: 0 !important; border-radius: 0 !important;
        display: flex; flex-direction: column;
      }
      ${DEMO} > div > div:first-child { flex: 1 1 auto; padding-block: 40px 0 !important; min-height: 0 !important; }
      ${DEMO} > div > div:last-child {
        border: 0 !important; width: 100%; max-width: 380px; margin-inline: auto; padding: 8px 0 40px !important;
      }
      ${DEMO} > div > div:last-child > :not(:nth-child(2)) { display: none !important; }
    `,
    script: async (page, view) =>
      tour(
        await center(page, `${DEMO} [aria-roledescription=carousel]`),
        await center(page, `${DEMO} [aria-label="Freeze card"]`),
        4,
        view,
      ),
  },

  // The lab's price plot in Minimist's own style (/lab/price-evidence/minimist on danolekh.com,
  // `pnpm dev` in that repo, `--url` for another port): the demo card centred, scaled to fit.
  "lab-price-evidence": {
    url: "http://localhost:3000/lab/price-evidence/minimist",
    view: { width: 960, height: 540 },
    ready: `${LAB("price-evidence")} [data-slot=mnm-zone]`,
    themed: true,
    accent: "#141413",
    css: `
      html, body { overflow: hidden !important; }
      ${LAB("price-evidence")} { position: fixed !important; inset: 0 !important; z-index: 2147483000; margin: 0 !important; }
      ${LAB("price-evidence")} .mnm-demo {
        position: absolute; inset: 0; border-radius: 0 !important; padding: 0 !important;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      ${LAB("price-evidence")} .mnm-demo > :not(style) { width: 800px; zoom: 0.84; }
      ${LAB("price-evidence")} .mnm-demo > p { text-align: center; }
    `,
    script: async (page, view) => priceEvidence(page, view),
  },

  // The same flow in Liquid Glass, the lab page's own look (the Minimist-styled one is
  // /lab/price-evidence/minimist): the backdrop edge to edge with the dock and the panel centred.
  // The glass has its own backdrop, so there's one cut, not a light and a dark.
  "lab-price-evidence-glass": {
    url: "http://localhost:3000/lab/price-evidence",
    view: { width: 960, height: 540 },
    ready: `${LAB("price-evidence")} [data-slot=mnm-backdrop] canvas[data-ready]`,
    accent: "#ffffff",
    css: `
      html, body { overflow: hidden !important; }
      ${LAB("price-evidence")} { position: fixed !important; inset: 0 !important; z-index: 2147483000; margin: 0 !important; }
      ${LAB("price-evidence")} .mnm-demo {
        position: absolute !important; inset: 0; border-radius: 0 !important; padding: 0 !important;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      ${LAB("price-evidence")} .mnm-demo > :not(style):not([data-slot=mnm-backdrop]) { width: 800px; zoom: 0.84; }
      ${LAB("price-evidence")} .mnm-demo > p { text-align: center; }
    `,
    // A second of stillness at each end: the backdrop never stops drifting, so encode it with
    // `--loop 0.8`, which crossfades the last 0.8 s into the first.
    script: async (page, view) => priceEvidence(page, view, 1000, 1000),
  },

  // Liquid Glass as its own lab item: one lens over big type on a still black stage, edge to edge.
  "lab-glass": {
    url: "http://localhost:3000/lab/glass",
    view: { width: 960, height: 540 },
    ready: `${LAB("glass")} [data-glass=bent]`,
    accent: "#ffffff",
    css: `
      html, body { overflow: hidden !important; }
      ${LAB("glass")} { position: fixed !important; inset: 0 !important; z-index: 2147483000; margin: 0 !important; }
      ${LAB("glass")} [data-slot=glass-demo] { height: 100%; }
      ${LAB("glass")} [data-slot=glass-stage] { height: 100% !important; border-radius: 0 !important; }
    `,
    script: glass,
  },

  // wild's headline smearing under the pointer, on their white page, edge to edge. No zoom: the
  // demo sizes its type from its own width, so the frame decides the lines.
  "lab-smear": {
    url: "http://localhost:3000/lab/smear",
    view: { width: 960, height: 540 },
    ready: `${LAB("smear")} canvas[data-ready]`,
    accent: "#1d1d1d",
    css: `
      html, body { overflow: hidden !important; }
      ${LAB("smear")} { position: fixed !important; inset: 0 !important; z-index: 2147483000; margin: 0 !important; background: #fff; }
      ${LAB("smear")} [data-slot=wild-demo] { height: 100%; display: flex; flex-direction: column; }
      ${LAB("smear")} [data-slot=wild-stage] { flex: 1 1 auto; aspect-ratio: auto !important; min-height: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
      ${LAB("smear")} [data-slot=wild-note] { margin: 0 !important; padding: 0 56px 24px; }
    `,
    script: smear,
  },
};
