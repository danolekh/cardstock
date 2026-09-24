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

const DEMO = '[data-demo="raiffeisen-card"]';

export const takes: Record<string, TakeDef> = {
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
