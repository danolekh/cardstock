/* Renders a poster for each built-in shader: its still frame, drawn by the library's own WebGL
 * code in headless Chrome, then cropped, encoded and measured by cardstock-backgrounds (colour,
 * tone and ink) into public/backgrounds/<id>-still.webp and -860.webp. The measurements go to
 * src/lib/shader-posters.json, which src/lib/backgrounds.ts reads, so the placeholder colour, the
 * poster and the ink always match what the shader draws.
 *
 *   pnpm --filter docs shaders [id…]      render posters (all, or the ids given)
 *   pnpm --filter docs shaders --check    only compile every shader; exits 1 on a GLSL error
 *
 * Needs @danolekh/cardstock built (pnpm --filter @danolekh/cardstock build) and Google Chrome (or
 * CHROME=/path/to/chrome). */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { promisify } from "node:util";

const W = 1720;
const H = 1080;
const DIST = new URL("../../../packages/cardstock/dist/", import.meta.url).pathname;
const OUT = new URL("../public/backgrounds/", import.meta.url).pathname;
const DATA = new URL("../src/lib/shader-posters.json", import.meta.url).pathname;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter((a) => !a.startsWith("--"));

if (!existsSync(join(DIST, "shader/index.js")))
  throw new Error("Build @danolekh/cardstock first: pnpm --filter @danolekh/cardstock build");

// The page imports the built modules as they ship, so the posters come from the published code.
const page = `<!doctype html><html><body><pre id="out"></pre><script type="module">
import { createBackend } from "/dist/shader/backend.js";
import { resolveParams } from "/dist/shader/params.js";
import { SHADER_PRESETS } from "/dist/shader/presets/index.js";
const only = ${JSON.stringify(only)};
const check = ${check};
const results = {};
const backend = createBackend();
if (!backend) results.$error = "no WebGL2";
for (const [id, load] of Object.entries(SHADER_PRESETS)) {
  if (!backend || (only.length && !only.includes(id))) continue;
  const def = await load();
  let state = backend.prepare(def);
  for (let i = 0; state === "pending" && i < 2000; i++) {
    await new Promise((r) => setTimeout(r, 5));
    state = backend.prepare(def);
  }
  if (state instanceof Error) { results[id] = { error: state.message }; continue; }
  if (check) { results[id] = { ok: true }; continue; }
  // Drawn as the library draws a card: into a 2D canvas of its own.
  const canvas = document.createElement("canvas");
  backend.draw(def, {
    // As a card shown 380px wide: what the poster stands in for.
    width: ${W}, height: ${H}, pixelRatio: ${W} / 380, time: def.still ?? 0, pointer: [0.5, 0.5], flip: 0, freeze: 0,
    seed: 0.37, frame: 0, uniforms: resolveParams(def, undefined),
  }, canvas.getContext("2d"));
  results[id] = { png: canvas.toDataURL("image/png"), label: def.label, credit: def.credit ?? null };
}
document.getElementById("out").textContent = "@@" + JSON.stringify(results) + "@@";
</script></body></html>`;

const TYPES: Record<string, string> = { ".js": "text/javascript", ".html": "text/html" };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/") return res.writeHead(200, { "content-type": "text/html" }).end(page);
  const path = normalize(join(DIST, url.pathname.replace(/^\/dist\//, "")));
  if (!url.pathname.startsWith("/dist/") || !path.startsWith(DIST) || !existsSync(path))
    return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as AddressInfo).port;

// Asynchronously: this process serves the page Chrome is loading. A cold Chrome sometimes runs out
// its virtual time before the page is done, so it gets a few tries.
const render = async () => {
  const { stdout } = await promisify(execFile)(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu-sandbox",
      "--ignore-gpu-blocklist",
      "--enable-unsafe-swiftshader",
      "--virtual-time-budget=60000",
      "--dump-dom",
      `http://127.0.0.1:${port}/`,
    ],
    { encoding: "utf8", maxBuffer: 1 << 30 },
  );
  return /<pre id="out">@@(.*)@@<\/pre>/s.exec(stdout)?.[1];
};
let json: string | undefined;
try {
  for (let attempt = 0; attempt < 3 && !json; attempt++) json = await render();
} finally {
  server.close();
}
if (!json) throw new Error("Chrome didn't finish the page.");
const results: Record<string, { error?: string; png?: string; label?: string; credit?: string | null }> =
  JSON.parse(
    json.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"'),
  );
if ("$error" in results) throw new Error(`Chrome has ${String(results.$error)}.`);

const failed = Object.entries(results).filter(([, r]) => r.error);
for (const [id, r] of failed) console.error(`✗ ${id}\n${r.error}\n`);
if (failed.length) process.exit(1);
if (check) {
  console.log(`✓ ${Object.keys(results).length} shaders compile.`);
  process.exit(0);
}

const { buildBackground } = await import(
  new URL("../../../packages/backgrounds/src/build.ts", import.meta.url).href
);
const posters: Record<string, unknown> = existsSync(DATA) ? JSON.parse(readFileSync(DATA, "utf8")) : {};
for (const [id, r] of Object.entries(results)) {
  const png = Buffer.from(r.png!.split(",")[1]!, "base64");
  const built = await buildBackground(png, {
    name: `${id}-still`,
    label: r.label,
    sizes: [W, 860],
    dir: OUT,
    base: "/backgrounds",
  });
  const { color, tone, ink, src, srcSet } = built.background;
  posters[id] = { color, tone, ink, poster: src, posterSrcSet: srcSet };
  // The PNG carries an alpha channel, all opaque; flattening it changes nothing.
  for (const w of built.warnings) if (!w.includes("transparency")) console.warn(`  ${id}: ${w}`);
  console.log(
    `✓ ${id}: ${color} ${tone}, ink ${ink} (${built.files.map((f: { file: string }) => f.file).join(", ")})`,
  );
}
writeFileSync(DATA, JSON.stringify(posters, null, 2) + "\n");
