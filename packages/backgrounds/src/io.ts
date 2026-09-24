/* Reading and writing files the careful way: every write goes to a temporary file beside the
 * target and is renamed over it, so an interrupted run or a failed checksum never leaves half a
 * file where the app expects a whole one. */

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Writes `bytes` to `path` through a temporary sibling and a rename, creating the directory. */
export async function writeAtomic(path: string, bytes: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.${randomBytes(4).toString("hex")}.tmp`);
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, path);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

/** The file's bytes, or null when there's no such file. */
export async function readIfExists(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** True for `http:` and `https:` URLs, which are fetched; anything else is a path or `file:`. */
export const isHttp = (source: string): boolean => /^https?:\/\//i.test(source);

/** The bytes at an http(s) URL, a `file:` URL or a local path. */
export async function readSource(source: string): Promise<Uint8Array> {
  if (isHttp(source)) {
    let res: Response;
    try {
      res = await fetch(source);
    } catch (error) {
      throw new Error(`Couldn't reach ${source}: ${(error as Error).message}`, { cause: error });
    }
    if (!res.ok)
      throw new Error(`${source} answered ${res.status}${res.statusText ? ` ${res.statusText}` : ""}.`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const path = source.startsWith("file:") ? fileURLToPath(source) : source;
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(`No file at ${path}.`, { cause: error });
    throw error;
  }
}
