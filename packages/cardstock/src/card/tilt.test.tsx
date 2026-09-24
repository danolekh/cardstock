import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Card } from "../index";

// A mouse: the tilt is off for coarse pointers and reduced motion.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (cb(0), 1));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement;

function Tilted() {
  return (
    <Card.Root>
      <Card.Tilt>
        <Card.TiltSurface maxTilt={{ x: 20 }}>
          <Card.Body />
        </Card.TiltSurface>
      </Card.Tilt>
    </Card.Root>
  );
}

describe("Card.Tilt", () => {
  it("keeps the hit area still and turns the surface", () => {
    render(<Tilted />);
    expect(slot("card-tilt").style.transform).toBe("");
    expect(slot("card-tilt-surface").style.transform).toContain("perspective(1100px)");
    const surface = slot("card-tilt-surface");
    expect(surface.style.transform).toContain("rotateY(calc(var(--card-tilt-x) * 20deg))");
    expect(surface.style.transform).toContain("rotateX(calc(var(--card-tilt-y) * -10deg))");
  });

  it("measures the pointer against the hit area, which doesn't move", () => {
    render(<Tilted />);
    const tilt = slot("card-tilt");
    tilt.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    act(() => {
      fireEvent.pointerEnter(tilt);
      fireEvent.pointerMove(tilt, { clientX: 150, clientY: 25 });
    });
    expect(tilt.hasAttribute("data-hovering")).toBe(true);
    expect(slot("card-tilt-surface").hasAttribute("data-hovering")).toBe(true);
    expect(tilt.style.getPropertyValue("--card-tilt-x")).toBe("0.5");
    expect(tilt.style.getPropertyValue("--card-tilt-y")).toBe("-0.5");
    act(() => {
      fireEvent.pointerLeave(tilt);
    });
    expect(tilt.hasAttribute("data-hovering")).toBe(false);
    expect(tilt.style.getPropertyValue("--card-tilt-x")).toBe("0");
  });

  it("warns once when the hit area itself is transformed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Card.Root>
        <Card.Tilt style={{ transform: "rotateY(10deg)" }} />
      </Card.Root>,
    );
    act(() => {
      fireEvent.pointerEnter(slot("card-tilt"));
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Card.TiltSurface"));
    warn.mockRestore();
  });
});
