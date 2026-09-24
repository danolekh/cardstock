import { describe, expect, it } from "vitest";

import { composeFragment, ShaderSourceError } from "./compose";
import { defineShader } from "./define";
import { SHADER_PRESETS } from "./presets";

describe("composeFragment", () => {
  it("declares the shared and parameter uniforms, and keeps GLSL as written", () => {
    const source = "void main() { fragColor = vec4(uTint, 1.); }";
    const out = composeFragment(
      defineShader({
        id: "test/glsl",
        label: "GLSL",
        source,
        params: {
          tint: { type: "color", default: "#fff" },
          colors: { type: "colors", default: ["#fff"], max: 3 },
        },
      }),
    );
    expect(out.startsWith("#version 300 es\n")).toBe(true);
    for (const u of [
      "float uTime",
      "vec2 uResolution",
      "vec2 uPointer",
      "float uFreeze",
      "vec3 uTint",
      "vec3 uColors[3]",
      "int uColorsCount",
    ])
      expect(out).toContain(`uniform ${u};`);
    expect(out).toContain(`#line 1\n${source}`);
  });

  it("wraps Shadertoy's mainImage, and refuses channels", () => {
    const out = composeFragment(
      defineShader({
        id: "test/toy",
        label: "Toy",
        dialect: "shadertoy",
        source: "void mainImage(out vec4 c, in vec2 p) { c = vec4(p / iResolution.xy, sin(iTime), 1.); }",
      }),
    );
    expect(out).toContain("#define iTime uTime");
    expect(out).toContain("mainImage(color, gl_FragCoord.xy);");
    expect(() =>
      composeFragment(
        defineShader({ id: "test/ch", label: "Ch", dialect: "shadertoy", source: "texture(iChannel0, p)" }),
      ),
    ).toThrow(ShaderSourceError);
  });

  it("runs twigl code as the body of main, with only the helpers it calls", () => {
    const out = composeFragment(
      defineShader({ id: "test/twigl", label: "Twigl", dialect: "twigl", source: "o.rgb = hsv(t, 1., 1.);" }),
    );
    expect(out).toContain("#define FC gl_FragCoord");
    expect(out).toMatch(/vec4 o = vec4\(0\.0\);\n#line 1\no\.rgb = hsv\(t, 1\., 1\.\);/);
    expect(out).toContain("vec3 hsv(");
    expect(out).not.toContain("snoise3D");
    // No preprocessor macros for the one-letter names, which would break swizzles like `.r`.
    expect(out).not.toMatch(/#define [rtmf]\b/);
  });

  it("composes every built-in preset", async () => {
    for (const load of Object.values(SHADER_PRESETS)) {
      const def = await load();
      expect(() => composeFragment(def)).not.toThrow();
      expect(def.license).toBeTruthy();
    }
  });
});
