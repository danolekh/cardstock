/* Shared test fixtures: a scratch directory per test, and a small valid manifest with two images
 * and a gradient, whose files are real bytes with real checksums. */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach } from "vitest";

import { sha256 } from "../src/io.ts";
import type { Manifest } from "../src/manifest.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** A fresh empty directory, removed after the test. */
export async function scratch(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cardstock-backgrounds-"));
  dirs.push(dir);
  return dir;
}

export const FILES: Record<string, Uint8Array> = {
  "holo.webp": new TextEncoder().encode("holo at 1720"),
  "holo-860.webp": new TextEncoder().encode("holo at 860"),
  "noir.webp": new TextEncoder().encode("noir at 1720"),
};

const file = (name: string, width: number, height: number) => ({
  file: name,
  width,
  height,
  bytes: FILES[name]!.byteLength,
  sha256: sha256(FILES[name]!),
});

export const manifest = (): Manifest => ({
  version: 1,
  base: "https://art.example/backgrounds/",
  license: "MIT",
  presets: {
    holo: {
      label: "Holo",
      tags: ["foil", "light"],
      background: { type: "image", color: "#c7b5f4", tone: "light", ink: "#231a3d" },
      files: [file("holo.webp", 1720, 1080), file("holo-860.webp", 860, 540)],
    },
    noir: {
      label: "Noir",
      tags: ["dark"],
      background: { type: "image", color: "#111218", tone: "dark", ink: "#e8e9f0" },
      files: [file("noir.webp", 1720, 1080)],
    },
    ink: {
      label: "Ink",
      tags: ["gradient", "dark"],
      background: {
        type: "linear",
        stops: [
          ["#34322d", 0],
          ["#080807", 1],
        ],
        ink: "#f1dfa6",
      },
      files: [],
    },
  },
});
