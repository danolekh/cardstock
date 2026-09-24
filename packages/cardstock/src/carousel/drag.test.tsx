import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardCarousel } from "./index";

// Each slide is 300px wide with a 20px gap: one slide of travel is 320px.
let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let renders = 0;
function Counted({ name }: { name: string }) {
  renders++;
  return <button type="button">{name}</button>;
}

function Example(props: React.ComponentProps<typeof CardCarousel.Root> & { onPress?: () => void }) {
  const { onPress, ...root } = props;
  return (
    <CardCarousel.Root snap={false} gap={20} {...root}>
      <CardCarousel.Track>
        {["A", "B", "C"].map((name) => (
          <CardCarousel.Slide key={name}>
            {name === "A" ? (
              <button type="button" onClick={onPress}>
                press
              </button>
            ) : (
              <Counted name={name} />
            )}
          </CardCarousel.Slide>
        ))}
      </CardCarousel.Track>
    </CardCarousel.Root>
  );
}

const track = () => document.querySelector('[data-slot="carousel-track"]') as HTMLElement;
const root = () => document.querySelector('[data-slot="carousel"]') as HTMLElement;
const current = () =>
  [...document.querySelectorAll('[data-slot="carousel-slide"]')].findIndex((s) =>
    s.hasAttribute("data-active"),
  );

/** A drag of `dx` px over `ms`, in `steps` moves. */
function drag(dx: number, ms: number, { dy = 0, steps = 5 } = {}) {
  const el = track();
  act(() => {
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 500, clientY: 100 });
  });
  for (let i = 1; i <= steps; i++) {
    now += ms / steps;
    act(() => {
      fireEvent.pointerMove(el, {
        pointerId: 1,
        clientX: 500 + (dx * i) / steps,
        clientY: 100 + (dy * i) / steps,
      });
    });
  }
  act(() => {
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 500 + dx, clientY: 100 + dy });
  });
}

describe("dragging the track", () => {
  it("lands on the next slide past halfway, slowly", () => {
    render(<Example />);
    drag(-200, 2000); // 0.625 of a slide, far too slow to count as a flick
    expect(current()).toBe(1);
  });

  it("goes back under halfway", () => {
    render(<Example />);
    drag(-100, 2000);
    expect(current()).toBe(0);
  });

  it("moves one slide on a short flick, and never more than one", () => {
    render(<Example />);
    drag(-60, 20);
    expect(current()).toBe(1);
    drag(-900, 40);
    expect(current()).toBe(2);
  });

  it("follows the finger at a fraction past the first slide", () => {
    render(<Example elastic={0.2} />);
    const el = track();
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 500, clientY: 100 });
      fireEvent.pointerMove(el, { pointerId: 1, clientX: 820, clientY: 100 });
    });
    expect(Number(root().style.getPropertyValue("--carousel-position"))).toBeCloseTo(-0.2);
    expect(root().hasAttribute("data-dragging")).toBe(true);
    act(() => {
      fireEvent.pointerUp(el, { pointerId: 1, clientX: 820, clientY: 100 });
    });
    expect(root().hasAttribute("data-dragging")).toBe(false);
  });

  it("leaves a mostly vertical move to the page", () => {
    render(<Example />);
    drag(-40, 2000, { dy: 200 });
    expect(root().style.getPropertyValue("--carousel-position")).toBe("0");
    expect(current()).toBe(0);
  });

  it("swallows the click that ends a drag", () => {
    const onPress = vi.fn<() => void>();
    render(<Example onPress={onPress} />);
    drag(-100, 2000);
    fireEvent.click(document.querySelector("button")!);
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector("button")!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("doesn't re-render the slides when a drag starts and ends", () => {
    render(<Example />);
    renders = 0;
    drag(-100, 2000);
    expect(renders).toBe(0);
  });

  it("runs the other way right to left", () => {
    render(<Example dir="rtl" />);
    drag(200, 2000);
    expect(current()).toBe(1);
  });

  it("still takes the elastic (and flick speed) from the track", () => {
    render(
      <CardCarousel.Root snap={false} gap={20}>
        <CardCarousel.Track elastic={0.5} flickVelocity={900}>
          <CardCarousel.Slide>A</CardCarousel.Slide>
          <CardCarousel.Slide>B</CardCarousel.Slide>
        </CardCarousel.Track>
      </CardCarousel.Root>,
    );
    const el = track();
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 500, clientY: 100 });
      fireEvent.pointerMove(el, { pointerId: 1, clientX: 820, clientY: 100 });
    });
    expect(Number(root().style.getPropertyValue("--carousel-position"))).toBeCloseTo(-0.5);
  });
});
