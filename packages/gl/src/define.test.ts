import { describe, expect, it } from "vitest";

import { defineShader, uniformName } from "./define";

describe("defineShader", () => {
  it("names uniforms after parameters and inputs", () => {
    expect(uniformName("level")).toBe("uLevel");
  });

  it("refuses bad ids, and an input that is also a parameter", () => {
    expect(() => defineShader({ id: "Bad Id", label: "x", source: "" })).toThrow(/shader id/);
    expect(() =>
      defineShader({
        id: "test/x",
        label: "x",
        source: "",
        inputs: ["level"],
        params: { level: { type: "float", default: 0, min: 0, max: 1 } },
      }),
    ).toThrow(/both a parameter and an input/);
  });
});
