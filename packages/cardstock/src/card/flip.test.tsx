import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Card, flipFrame, flipOriginAt } from "../index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement;
const Y = { axis: "y", direction: 1 } as const;

describe("flipFrame", () => {
  it("turns from front to back, lit most when edge-on", () => {
    expect(flipFrame(0, ["sheen"], Y).angle).toBe(0);
    expect(flipFrame(1, ["sheen"], Y).angle).toBe(180);
    expect(flipFrame(0, ["sheen"], Y).light).toBe(0);
    // Edge-on (90°) is where the light peaks; the eased turn gets there before halfway.
    const times = Array.from({ length: 101 }, (_, i) => i / 100);
    const edgeOn = times.map((t) => flipFrame(t, ["sheen"], Y)).find((f) => f.angle >= 90)!;
    expect(edgeOn.light).toBeGreaterThan(0.99);
    const mid = flipFrame(0.5, ["sheen"], Y);
    // The band crosses the face: from the far side to the near one.
    expect(flipFrame(0, ["sheen"], Y).sheen).toBeCloseTo(100);
    expect(flipFrame(1, ["sheen"], Y).sheen).toBeCloseTo(0);
    expect(mid.lift).toBe(0);
  });

  it("lifts before it turns and lands after", () => {
    expect(flipFrame(0.1, ["lift"], Y).angle).toBe(0);
    expect(flipFrame(0.1, ["lift"], Y).lift).toBeGreaterThan(0);
    expect(flipFrame(0.5, ["lift"], Y).lift).toBe(1);
    expect(flipFrame(0.9, ["lift"], Y).angle).toBe(180);
    expect(flipFrame(1, ["lift"], Y).lift).toBe(0);
  });

  it("turns the way it was started from", () => {
    expect(flipFrame(1, ["toward"], { axis: "x", direction: -1 }).angle).toBe(-180);
  });

  it("picks the axis and direction from where the card was pressed", () => {
    expect(flipOriginAt(0.5, 0.05)).toEqual({ axis: "x", direction: -1 });
    expect(flipOriginAt(0.5, 0.95)).toEqual({ axis: "x", direction: 1 });
    expect(flipOriginAt(0.9, 0.5)).toEqual({ axis: "y", direction: -1 });
    expect(flipOriginAt(0.1, 0.5)).toEqual({ axis: "y", direction: 1 });
  });
});

function Flippable(props: React.ComponentProps<typeof Card.Body>) {
  return (
    <Card.Root>
      <Card.Body {...props}>
        <Card.Front>front</Card.Front>
        <Card.Back>back</Card.Back>
      </Card.Body>
      <Card.FlipTrigger>Flip</Card.FlipTrigger>
    </Card.Root>
  );
}

describe("Card.Body", () => {
  it("turns itself with the sheen by default", () => {
    render(<Flippable />);
    const body = slot("card-body");
    expect(body.style.transform).toContain("rotateY(calc(var(--card-flip-angle)");
    expect(body.style.transform).toContain("perspective(1100px)");
    expect(slot("card-back").style.transform).toContain("rotateY(");
    expect(slot("card-front").querySelector('[data-slot="card-sheen"]')).toBeTruthy();
    expect(body.style.getPropertyValue("--card-flip-angle")).toBe("0");
  });

  it("lifts with `lift`, and leaves the sheen out unless asked", () => {
    render(<Flippable effect={["lift"]} />);
    expect(slot("card-body").style.transform).toContain("translateZ(calc(var(--card-flip-lift) * 60px))");
    expect(document.querySelector('[data-slot="card-sheen"]')).toBeNull();
  });

  it("leaves the turn to you with `none`, still writing the variables", () => {
    render(<Flippable effect="none" />);
    expect(slot("card-body").style.transform).toBe("");
    expect(slot("card-back").style.transform).toBe("");
    expect(slot("card-body").style.getPropertyValue("--card-flip")).toBe("0");
    expect(document.querySelector('[data-slot="card-sheen"]')).toBeNull();
  });

  it("turns top to bottom when pressed near the top, with `toward`", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Flippable effect="toward" />);
    const trigger = slot("card-flip-trigger");
    trigger.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 190 }) as DOMRect;
    act(() => {
      fireEvent.pointerDown(trigger, { clientX: 150, clientY: 10 });
      fireEvent.click(trigger);
    });
    // Reduced motion here, so the flip lands at once: straight at the back, turned top to bottom.
    const body = slot("card-body");
    expect(body.style.getPropertyValue("--card-flip-axis-x")).toBe("1");
    expect(body.style.getPropertyValue("--card-flip-angle")).toBe("-180");
  });

  it("cross-fades the faces instead of turning for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Flippable />);
    expect(slot("card-body").style.transform).toBe("");
    expect(slot("card-front").style.opacity).toBe("1");
    expect(slot("card-back").style.opacity).toBe("0");
    act(() => {
      fireEvent.click(slot("card-flip-trigger"));
    });
    expect(slot("card-back").style.opacity).toBe("1");
  });
});
