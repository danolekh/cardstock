// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Card, shaderBackground } from "../index";
import { Shader } from "./index";

describe("server rendering", () => {
  it("renders the colour, the poster and a hidden canvas, touching no browser API", () => {
    const bg = shaderBackground("silk", { color: "#1b1530", poster: "/backgrounds/silk.webp" });
    const out = renderToString(
      <Card.Root background={bg}>
        <Card.Background>
          <Shader />
        </Card.Background>
      </Card.Root>,
    );
    expect(out).toContain("background-color:#1b1530");
    expect(out).toContain('src="/backgrounds/silk.webp"');
    expect(out).toMatch(/<canvas[^>]*data-slot="card-shader"[^>]*>/);
    expect(out).toMatch(/<canvas[^>]*opacity:0/);
  });
});
