import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Card, type CardBackground, shaderBackground } from "../index";
import { defineShader, Shader, ShaderLibrary } from "./index";

afterEach(cleanup);

const silk = shaderBackground("silk", { color: "#1b1530", poster: "/backgrounds/silk.webp" });
const canvas = () => document.querySelector('[data-slot="card-shader"]') as HTMLCanvasElement | null;
const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));

describe("Shader", () => {
  it("draws the background's shader over its poster, and nothing for other backgrounds", () => {
    const { rerender } = render(
      <Card.Root background={silk}>
        <Card.Background>
          <Shader />
        </Card.Background>
      </Card.Root>,
    );
    expect(document.querySelector('[data-slot="card-background-image"]')?.getAttribute("src")).toBe(
      "/backgrounds/silk.webp",
    );
    expect(canvas()).not.toBeNull();
    rerender(
      <Card.Root background={{ type: "solid", color: "#000" }}>
        <Card.Background>
          <Shader />
        </Card.Background>
      </Card.Root>,
    );
    expect(canvas()).toBeNull();
  });

  it("follows a Card.Background's value over the card's", () => {
    const plain: CardBackground = { type: "solid", color: "#000" };
    render(
      <Card.Root background={plain}>
        <Card.Background value={silk}>
          <Shader />
        </Card.Background>
      </Card.Root>,
    );
    expect(canvas()).not.toBeNull();
  });

  it("stays hidden and marks itself failed where there's no WebGL2", async () => {
    render(
      <Card.Root background={silk}>
        <Card.Background>
          <Shader />
        </Card.Background>
      </Card.Root>,
    );
    await settle();
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(canvas()!.style.opacity).toBe("0");
    expect(canvas()!.hasAttribute("data-failed")).toBe(true);
  });

  it("fails an unknown id, and finds it in a ShaderLibrary", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bg: CardBackground = { type: "shader", shader: "acme/tide", color: "#000" };
    const { unmount } = render(
      <Card.Root background={bg}>
        <Card.Background>
          <Shader />
        </Card.Background>
      </Card.Root>,
    );
    await settle();
    expect(canvas()!.hasAttribute("data-failed")).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no shader "acme/tide"'));
    unmount();
    warn.mockRestore();

    const tide = defineShader({
      id: "acme/tide",
      label: "Tide",
      source: "void main() { fragColor = vec4(1.); }",
    });
    render(
      <ShaderLibrary shaders={[tide]}>
        <Card.Root background={bg}>
          <Card.Background>
            <Shader />
          </Card.Background>
        </Card.Root>
      </ShaderLibrary>,
    );
    expect(canvas()).not.toBeNull();
  });

  it("works outside a card with a value", () => {
    render(<Shader value={silk} className="hero" />);
    expect(canvas()?.className).toBe("hero");
  });
});
