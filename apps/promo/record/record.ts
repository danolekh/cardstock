/* Films a take (takes.ts) and writes the video.
 *
 *   pnpm --filter promo stage                                   # for `cardstock`
 *   pnpm --filter promo record <take> [--theme light|dark] [--fast] [--url <origin>]
 *                                                               # → out/<take>[-<theme>].mp4
 *
 * Every frame is rendered on purpose rather than filmed live: a shim (clock.js) gives the page a
 * virtual clock (performance.now, Date.now, rAF, timers) and holds every CSS transition to it, and
 * each frame steps that clock by exactly one interval before the screenshot. Nothing drops, however
 * slow the capture. Frames are taken at 120fps and 3840 wide, and pairs are blended into 60fps
 * 1080p, which gives the motion a light blur. `--fast` takes 60fps at 1080p for a quick look. */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { takes } from "./takes.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args[i + 1];
};
const name = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "cardstock";
const def = takes[name];
if (!def) throw new Error(`no take "${name}"; there are: ${Object.keys(takes).join(", ")}`);
const theme = flag("theme");
if (theme && !def.themed) throw new Error(`the ${name} take has no themes`);
const FAST = args.includes("--fast");
const VIEW = def.view;
const SCALE = (FAST ? 1920 : 3840) / VIEW.width;
const FPS = FAST ? 60 : 120;
const URL_ = flag("url") ? new URL(new URL(def.url).pathname, flag("url")).href : def.url;
const OUT = join(new URL("..", import.meta.url).pathname, "out");
const local = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    channel: "chromium",
    // A real device scale, not only the emulated one: under emulation Chrome rasterizes anything
    // turned in 3D (the tilt, the side cards) at 1×, so it comes out blocky or smeared.
    args: [
      "--use-angle=metal",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--force-color-profile=srgb",
      `--force-device-scale-factor=${SCALE}`,
    ],
  });
  const page = await browser.newPage({
    viewport: VIEW,
    deviceScaleFactor: SCALE,
    reducedMotion: "no-preference",
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  page.on("pageerror", (e) => console.error(e));
  if (theme) await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.addInitScript({ content: local("clock.js") });
  await page.addInitScript((accent) => ((window as any).__cursorAccent = accent), def.accent);
  await page.addInitScript({ content: local("cursor.js") });
  await page.goto(URL_);
  await page.waitForSelector(def.ready, { timeout: 30_000 });
  if (def.css) await page.addStyleTag({ content: def.css });
  await sleep(2500); // frost arms and snapshots each face a moment after load
  if (!(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)))
    throw new Error("the page reports no fine pointer, so the card wouldn't tilt");

  const take = await def.script(page, VIEW);
  const interval = 1000 / FPS;
  const total = Math.ceil(take.t / interval);

  mkdirSync(OUT, { recursive: true });
  const out = join(OUT, `${name}${theme ? `-${theme}` : ""}.mp4`);
  const filters = [
    ...(FAST ? [] : ["tmix=frames=2", "fps=60"]),
    "scale=1920:1080:flags=lanczos",
    "format=yuv420p",
  ];
  const ffmpeg = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "-"]
      .concat(["-vf", filters.join(","), "-r", "60"])
      .concat(["-c:v", "libx264", "-preset", "slow", "-crf", "12", "-profile:v", "high"])
      .concat([
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-color_range",
        "tv",
      ])
      .concat(["-movflags", "+faststart", out]),
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((resolve) => ffmpeg.on("exit", resolve));

  // From here on the page's clocks only move when a frame is taken.
  await page.evaluate(() => (window as any).__clock.start());
  let prev = { pos: [-1, -1] as [number, number], down: false };
  const started = Date.now();
  for (let i = 0; i < total; i++) {
    const time = i * interval;
    const [x, y] = take.at(time);
    const down = take.down(time);
    if (x !== prev.pos[0] || y !== prev.pos[1]) await page.mouse.move(x, y);
    if (down !== prev.down) await (down ? page.mouse.down() : page.mouse.up());
    prev = { pos: [x, y], down };

    await page.evaluate((ms) => (window as any).__clock.step(ms), interval);
    // Playwright's screenshot, not the raw DevTools one: that one comes back at CSS size.
    const png = await page.screenshot({
      type: "png",
      scale: "device",
      animations: "allow",
      caret: "initial",
    });
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (i % FPS === 0) process.stdout.write(`\r${Math.round((i / total) * 100)}%`);
  }
  ffmpeg.stdin.end();
  await done;
  await browser.close();
  console.log(`\r${total} frames in ${((Date.now() - started) / 1000).toFixed(0)}s → ${out}`);
}

await main();
