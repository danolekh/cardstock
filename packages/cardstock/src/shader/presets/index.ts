/* The built-in shaders, each loaded on first use: a card showing `silk` fetches silk's GLSL and no
 * other. `loadShaderPreset` gets one by id; `SHADER_PRESETS` lists them. */

import type { BuiltInShader } from "../../background/background";
import type { ShaderDefinition } from "../define";

export const SHADER_PRESETS: Readonly<Record<BuiltInShader, () => Promise<ShaderDefinition>>> = {
  singularity: () => import("./singularity").then((m) => m.singularity),
  silk: () => import("./silk").then((m) => m.silk),
  mesh: () => import("./mesh").then((m) => m.mesh),
  grain: () => import("./grain").then((m) => m.grain),
  "liquid-metal": () => import("./liquid-metal").then((m) => m.liquidMetal),
  "holo-foil": () => import("./holo-foil").then((m) => m.holoFoil),
  "flow-dots": () => import("./flow-dots").then((m) => m.flowDots),
  guilloche: () => import("./guilloche").then((m) => m.guilloche),
};

const loaded = new Map<string, Promise<ShaderDefinition>>();

/** A built-in shader's definition, loaded once; undefined for an id that isn't built in. */
export function loadShaderPreset(id: string): Promise<ShaderDefinition> | undefined {
  if (!Object.hasOwn(SHADER_PRESETS, id)) return undefined;
  let p = loaded.get(id);
  if (!p) {
    p = SHADER_PRESETS[id as BuiltInShader]();
    // A chunk that failed to load (a flaky network) can be asked for again.
    p.catch(() => loaded.delete(id));
    loaded.set(id, p);
  }
  return p;
}
