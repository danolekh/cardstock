/* A background's parameters, made safe for the GPU: each one the shader declares, from the data
 * when it's the right kind and clamped to range, else its default. Names the shader doesn't
 * declare are dropped. */

import { parseRgb, type ShaderParamValue } from "../background/background";
import { type ShaderDefinition, uniformName } from "./define";

export type ResolvedUniform =
  | { name: string; kind: "float"; value: number }
  | { name: string; kind: "vec3"; value: Float32Array }
  | { name: string; kind: "vec3[]"; value: Float32Array; count: number; countName: string };

const rgb = (color: string): [number, number, number] | null => {
  const c = parseRgb(color);
  return c ? [c[0] / 255, c[1] / 255, c[2] / 255] : null;
};

// Read through a typeof check: in a bundle it's replaced, in a browser without one it isn't defined.
declare const process: { env: { NODE_ENV?: string } } | undefined;
const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const warned = new Set<string>();

export function resolveParams(
  definition: ShaderDefinition,
  params: Readonly<Record<string, ShaderParamValue>> | undefined,
): ResolvedUniform[] {
  const given = params ?? {};
  if (DEV)
    for (const name of Object.keys(given))
      if (!definition.params?.[name] && !warned.has(`${definition.id}:${name}`)) {
        warned.add(`${definition.id}:${name}`);
        console.warn(`cardstock: shader "${definition.id}" has no parameter "${name}"; it's ignored.`);
      }
  return Object.entries(definition.params ?? {}).map(([param, spec]): ResolvedUniform => {
    const name = uniformName(param);
    const value = given[param];
    switch (spec.type) {
      case "float": {
        const n = typeof value === "number" && Number.isFinite(value) ? value : spec.default;
        return { name, kind: "float", value: Math.min(spec.max, Math.max(spec.min, n)) };
      }
      case "color": {
        const c = (typeof value === "string" && rgb(value)) || rgb(spec.default) || [0, 0, 0];
        return { name, kind: "vec3", value: new Float32Array(c) };
      }
      case "colors": {
        const colorsOf = (v: unknown) =>
          Array.isArray(v)
            ? v.map((c) => (typeof c === "string" ? rgb(c) : null)).filter((c) => c !== null)
            : [];
        const list = colorsOf(value);
        const colors = list.length >= (spec.min ?? 1) ? list : colorsOf(spec.default);
        const count = Math.min(colors.length, spec.max);
        const out = new Float32Array(spec.max * 3);
        colors.slice(0, count).forEach((c, i) => out.set(c, i * 3));
        return { name, kind: "vec3[]", value: out, count, countName: `${name}Count` };
      }
    }
  });
}
