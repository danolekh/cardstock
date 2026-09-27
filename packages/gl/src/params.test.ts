import { describe, expect, it } from "vitest";

import { defineShader } from "./define";
import { resolveParams } from "./params";

const def = defineShader({
  id: "test/params",
  label: "Params",
  source: "void main() { fragColor = vec4(1.); }",
  params: {
    amount: { type: "float", default: 0.5, min: 0, max: 1 },
    tint: { type: "color", default: "#ff0000" },
    colors: { type: "colors", default: ["#000000", "#ffffff"], min: 2, max: 4 },
  },
});

describe("resolveParams", () => {
  it("uses the defaults, as uniforms named u + the parameter", () => {
    const [amount, tint, colors] = resolveParams(def, undefined);
    expect(amount).toEqual({ name: "uAmount", kind: "float", value: 0.5 });
    expect(tint).toMatchObject({ name: "uTint", kind: "vec3" });
    expect([...(tint!.value as Float32Array)]).toEqual([1, 0, 0]);
    expect(colors).toMatchObject({ name: "uColors", kind: "vec3[]", count: 2, countName: "uColorsCount" });
    expect((colors!.value as Float32Array).length).toBe(12);
  });

  it("clamps numbers and falls back on colours it can't read", () => {
    const [amount, tint] = resolveParams(def, { amount: 7, tint: "oklch(50% 0 0)" });
    expect(amount!.value).toBe(1);
    expect([...(tint!.value as Float32Array)]).toEqual([1, 0, 0]);
  });

  it("takes a colour list up to its max, and the default when it's too short", () => {
    const [, , many] = resolveParams(def, { colors: ["#fff", "#000", "#f00", "#0f0", "#00f"] });
    expect(many).toMatchObject({ count: 4 });
    expect([...(many!.value as Float32Array)].slice(6, 9)).toEqual([1, 0, 0]);
    const [, , short] = resolveParams(def, { colors: ["#fff"] });
    expect([...(short!.value as Float32Array)].slice(0, 6)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("drops parameters the shader doesn't have", () => {
    expect(resolveParams(def, { nope: 1 }).map((u) => u.name)).toEqual(["uAmount", "uTint", "uColors"]);
  });
});
