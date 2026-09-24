/* The CLI as users run it: built, in a child process. It's built into a cache rather than dist/,
 * which the package's own build task may be rewriting at the same moment. */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { manifest, scratch } from "./helpers.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "node_modules/.cache/cli-test");
const cli = join(out, "cli.js");

beforeAll(() => {
  execFileSync(
    join(root, "node_modules/.bin/tsdown"),
    ["--logLevel", "error", "--out-dir", out, "--no-dts"],
    { cwd: root },
  );
}, 60_000);

const run = (args: string[], cwd = root) =>
  spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });

describe("cardstock-backgrounds", () => {
  it("is built without React", () => {
    expect(readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
    for (const file of readdirSync(out).filter((f) => f.endsWith(".js")))
      expect(readFileSync(join(out, file), "utf8")).not.toMatch(
        /^import (?!type ).* from "(?:react|@danolekh\/cardstock)/m,
      );
  });

  it("prints help and its version", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/Usage\n {2}cardstock-backgrounds list/);
    const version = run(["--version"]);
    expect(version.stdout.trim()).toBe(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  });

  it("lists a manifest as JSON", async () => {
    const dir = await scratch();
    const path = join(dir, "manifest.json");
    writeFileSync(path, JSON.stringify(manifest()));
    const r = run(["list", "--manifest", path, "--json"]);
    expect(r.status).toBe(0);
    expect(Object.keys(JSON.parse(r.stdout).presets)).toEqual(["holo", "noir", "ink"]);
    expect(run(["list", "--manifest", path]).stdout).toMatch(/^holo +Holo +image/m);
  });

  it("explains mistakes and exits with 2", async () => {
    const dir = await scratch();
    const path = join(dir, "manifest.json");
    writeFileSync(path, JSON.stringify(manifest()));
    const unknown = run(["add", "hollo", "--manifest", path], dir);
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toMatch(/did you mean "holo"/);
    expect(run(["lsit"]).stderr).toMatch(/Did you mean "list"/);
    expect(run(["list", "--hsah"]).stderr).toMatch(/Did you mean --hash/);
    expect(run(["list", "--force"]).stderr).toMatch(/list doesn't take --force/);
    expect(existsSync(join(dir, "lib"))).toBe(false);
  });

  it("exits with 1 when something outside goes wrong", async () => {
    const dir = await scratch();
    const r = run(["list", "--manifest", join(dir, "nothing.json")]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/No file at/);
  });
});
