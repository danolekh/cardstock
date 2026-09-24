/* How smooth a swipe is, in numbers: three scripted swipes on the carousel, at full speed and at
 * 4× CPU throttle (a mid-range laptop or phone), in a real headed Chrome at a real 2× scale.
 *
 *   pnpm --filter docs build && pnpm --filter docs preview --port 4300   # the production build
 *   pnpm --filter promo perf [url]                                         # http://localhost:4300/
 *
 * Prints, per speed: frames per second, the 95th-percentile frame time, how many frames took over
 * 12ms (a dropped frame at 120Hz), and the style recalculation per frame (median, 95th percentile,
 * and elements restyled) from a DevTools trace. Run it before and after a change to the carousel
 * or the card. */
import { chromium, type Page } from "playwright";

const URL_ = process.argv[2] ?? "http://localhost:4300/";

async function swipe(page: Page, cx: number, cy: number, dx: number, moves: number) {
  await page.mouse.move(cx - Math.sign(dx) * 100, cy);
  await page.mouse.down();
  for (let i = 1; i <= moves; i++) {
    await page.mouse.move(cx - Math.sign(dx) * 100 + (dx * i) / moves, cy);
    await page.waitForTimeout(14);
  }
  await page.mouse.up();
}

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

async function main() {
  const browser = await chromium.launch({
    channel: "chromium",
    headless: false,
    args: [
      "--use-angle=metal",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--force-device-scale-factor=2",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(URL_);
    await page.waitForSelector("[data-slot=carousel-track]");
    await page.waitForTimeout(4000); // fonts, artwork and frost settle
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const box = (await page.locator("[data-slot=carousel-viewport]").first().boundingBox())!;
    const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];

    const frames: number[] = [];
    const styles: { ms: number; elements: number }[] = [];
    for (let run = 0; run < 3; run++) {
      await page.evaluate(() => {
        const w = window as unknown as { __frames: number[] };
        w.__frames = [];
        const start = performance.now();
        const loop = () => {
          w.__frames.push(performance.now());
          if (performance.now() - start < 1800) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      await browser.startTracing(page, { categories: ["devtools.timeline"] });
      await swipe(page, cx, cy, -225, 25);
      await page.waitForTimeout(1900);
      const trace = JSON.parse((await browser.stopTracing()).toString()) as {
        traceEvents: { name: string; dur?: number; args?: { elementCount?: number } }[];
      };
      for (const e of trace.traceEvents)
        if (e.name === "UpdateLayoutTree" && e.dur)
          styles.push({ ms: e.dur / 1000, elements: e.args?.elementCount ?? 0 });
      const t = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames);
      frames.push(...t.slice(1).map((x, i) => x - t[i]!));
      // And back, untimed, so every run starts on the same card.
      await swipe(page, cx, cy, 240, 10);
      await page.waitForTimeout(1500);
    }

    const sorted = [...frames].sort((a, b) => a - b);
    const ms = styles.map((s) => s.ms).sort((a, b) => a - b);
    const elements = styles.map((s) => s.elements).sort((a, b) => a - b);
    const total = frames.reduce((a, b) => a + b, 0);
    console.log(
      `${rate}× cpu  ${((frames.length / total) * 1000).toFixed(0)} fps  p95 ${pct(sorted, 0.95).toFixed(1)}ms  ` +
        `over 12ms ${frames.filter((d) => d > 12).length} (of ${frames.length})  ` +
        `style ${pct(ms, 0.5).toFixed(2)}ms p50 / ${pct(ms, 0.95).toFixed(2)}ms p95, ${pct(elements, 0.5)} elements`,
    );
    await page.close();
  }
  await browser.close();
}

await main();
