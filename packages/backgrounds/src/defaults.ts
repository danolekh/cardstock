/* Where things go when the flags don't say. The defaults suit the common layout of a Vite, Next or
 * TanStack Start app: images in public/backgrounds, served from /backgrounds, and the presets file
 * beside the app's other modules in src/lib. */

import { existsSync } from "node:fs";
import { isAbsolute, join, normalize, relative, sep } from "node:path";

export const DEFAULT_DIR = "public/backgrounds";

/** The URL the files in `dir` are served from: the directory with its leading `public/` taken
 * off, as static hosts serve that folder at the root. Throws when there's no sensible guess (a
 * directory outside the project), which is when the caller has to give `--base`. */
export function defaultBase(dir: string, cwd: string = process.cwd()): string {
  const rel = relative(cwd, isAbsolute(dir) ? dir : join(cwd, dir));
  if (!rel || rel.startsWith("..") || isAbsolute(rel))
    throw new Error(`Can't tell what URL ${dir} is served from; pass --base (e.g. --base /backgrounds).`);
  const parts = normalize(rel).split(sep);
  if (parts[0] === "public") parts.shift();
  return `/${parts.join("/")}`;
}

/** src/lib/card-backgrounds.ts when the project has a src folder, else lib/card-backgrounds.ts. */
export function defaultOut(json = false, cwd: string = process.cwd()): string {
  const file = `card-backgrounds.${json ? "json" : "ts"}`;
  return existsSync(join(cwd, "src")) ? join("src", "lib", file) : join("lib", file);
}

/** Checks a `--base` the card will accept: an https: URL or a root-relative path. */
export function checkBase(base: string): string {
  const trimmed = base.replace(/\/+$/, "") || "/";
  if (!/^(?:https:\/\/[^\s"'()\\<>]+|\/(?!\/)[^\s"'()\\<>]*)$/i.test(trimmed))
    throw new Error(
      `--base should be an https: URL or a path from the site root such as /backgrounds, got "${base}".`,
    );
  return trimmed === "/" ? "" : trimmed;
}
