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

const DEMO = '[data-demo="raiffeisen-card"]';

const SHADER_CARDS = ["holo-foil", "silk", "singularity", "mesh", "liquid-metal"];

export const takes: Record<string, TakeDef> = {
  // The library, on cards in Raiffeisen's style, for the pitch: stage/raiffeisen.
  "raiffeisen-library": {
    url: "http://localhost:4173/?scene=raiffeisen",
    view: { width: 800, height: 450 },
    ready: "html[data-ready]",
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
};
