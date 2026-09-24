import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardCarousel, useCarouselSlide } from "./index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NAMES = ["Ink", "Paper", "Sage"];

function Example(props: React.ComponentProps<typeof CardCarousel.Root> & { tabs?: boolean }) {
  const { tabs, ...root } = props;
  return (
    <CardCarousel.Root snap={false} {...root}>
      <CardCarousel.Viewport>
        <CardCarousel.Track>
          {NAMES.map((name) => (
            <CardCarousel.Slide key={name} label={name}>
              {({ active, offset }) => (
                <button type="button" data-active-card={active} data-offset={offset}>
                  {name}
                </button>
              )}
            </CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Viewport>
      <CardCarousel.Previous />
      <CardCarousel.Next />
      {tabs && (
        <CardCarousel.Indicators>
          {NAMES.map((name) => (
            <CardCarousel.Indicator key={name}>{name}</CardCarousel.Indicator>
          ))}
        </CardCarousel.Indicators>
      )}
    </CardCarousel.Root>
  );
}

const slides = () => [...document.querySelectorAll('[data-slot="carousel-slide"]')] as HTMLElement[];
const region = () => screen.getByRole("region");

describe("CardCarousel", () => {
  it("labels and focuses the region, and numbers slides by their order", () => {
    render(<Example />);
    expect(region().getAttribute("aria-label")).toBe("Cards");
    expect(region().getAttribute("aria-roledescription")).toBe("carousel");
    expect(region().tabIndex).toBe(0);
    expect(slides().map((s) => s.getAttribute("aria-label"))).toEqual([
      "Ink, 1 of 3",
      "Paper, 2 of 3",
      "Sage, 3 of 3",
    ]);
    expect(slides().map((s) => s.dataset.index)).toEqual(["0", "1", "2"]);
  });

  it("makes slides out of focus inert, and the current one not", () => {
    render(<Example defaultIndex={1} />);
    const [a, b, c] = slides();
    expect(a!.inert).toBe(true);
    expect(a!.getAttribute("aria-hidden")).toBe("true");
    expect(b!.inert).toBe(false);
    expect(b!.hasAttribute("aria-hidden")).toBe(false);
    expect(c!.dataset.side).toBe("next");
    expect(a!.dataset.side).toBe("previous");
  });

  it("translates what it reads out", () => {
    render(
      <Example
        labels={{
          carousel: "Karten",
          next: "Nächste Karte",
          slide: (i, n, label) => `${label}, ${i + 1} von ${n}`,
        }}
      />,
    );
    expect(region().getAttribute("aria-label")).toBe("Karten");
    expect(screen.getByRole("button", { name: "Nächste Karte" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous card" })).toBeTruthy();
    expect(slides()[0]!.getAttribute("aria-label")).toBe("Ink, 1 von 3");
  });

  it("moves with the arrow keys, Home and End, and writes each slide's offset", () => {
    const onIndexChange = vi.fn<(index: number) => void>();
    render(<Example onIndexChange={onIndexChange} />);
    fireEvent.keyDown(region(), { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(slides()[1]!.hasAttribute("data-active")).toBe(true);
    expect(slides()[0]!.style.getPropertyValue("--slide-offset")).toBe("-1");
    expect(slides()[2]!.style.getPropertyValue("--slide-distance")).toBe("1");
    fireEvent.keyDown(region(), { key: "End" });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(region(), { key: "Home" });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it("mirrors the arrow keys right to left", () => {
    const onIndexChange = vi.fn<(index: number) => void>();
    render(<Example dir="rtl" onIndexChange={onIndexChange} />);
    fireEvent.keyDown(region(), { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(document.querySelector('[data-slot="carousel"]')!.getAttribute("data-dir")).toBe("rtl");
  });

  it("leaves arrow keys alone while typing in a field on a slide", () => {
    const onIndexChange = vi.fn<(index: number) => void>();
    render(
      <CardCarousel.Root snap={false} onIndexChange={onIndexChange}>
        <CardCarousel.Viewport>
          <CardCarousel.Track>
            <CardCarousel.Slide>
              <input aria-label="Name" />
            </CardCarousel.Slide>
            <CardCarousel.Slide>B</CardCarousel.Slide>
          </CardCarousel.Track>
        </CardCarousel.Viewport>
      </CardCarousel.Root>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowRight" });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("disables Previous on the first card and Next on the last", () => {
    render(<Example defaultIndex={2} />);
    expect((screen.getByRole("button", { name: "Next card" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous card" }));
    expect(slides()[1]!.hasAttribute("data-active")).toBe(true);
  });

  it("selects a neighbour when it is clicked", () => {
    render(<Example />);
    fireEvent.click(slides()[1]!);
    expect(slides()[1]!.hasAttribute("data-active")).toBe(true);
  });

  it("gives slide content its state, as a function or through the hook", () => {
    function Readout() {
      const { index, active } = useCarouselSlide();
      return <span data-testid={`readout-${index}`}>{active ? "current" : "aside"}</span>;
    }
    render(
      <CardCarousel.Root snap={false} defaultIndex={1}>
        <CardCarousel.Track>
          <CardCarousel.Slide>
            <Readout />
          </CardCarousel.Slide>
          <CardCarousel.Slide>
            <Readout />
          </CardCarousel.Slide>
        </CardCarousel.Track>
      </CardCarousel.Root>,
    );
    expect(screen.getByTestId("readout-0").textContent).toBe("aside");
    expect(screen.getByTestId("readout-1").textContent).toBe("current");
    cleanup();
    render(<Example defaultIndex={1} />);
    const buttons = [...document.querySelectorAll("button[data-offset]")] as HTMLElement[];
    expect(buttons.map((b) => b.dataset.offset)).toEqual(["-1", "0", "1"]);
    expect(buttons[1]!.dataset.activeCard).toBe("true");
  });

  it("turns indicators into tabs for the slides", () => {
    render(<Example tabs />);
    const tablist = screen.getByRole("tablist", { name: "Choose a card" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[1]!.getAttribute("aria-controls")).toBe(slides()[1]!.id);
    expect(slides()[1]!.getAttribute("role")).toBe("tabpanel");
    expect(slides()[1]!.getAttribute("aria-labelledby")).toBe(tabs[1]!.id);
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getAllByRole("tab")[1]!.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getAllByRole("tab")[1]);
    fireEvent.click(screen.getAllByRole("tab")[2]!);
    expect(slides()[2]!.hasAttribute("data-active")).toBe(true);
  });

  it("renders one indicator per slide when given none", () => {
    render(
      <CardCarousel.Root snap={false}>
        <CardCarousel.Track>
          <CardCarousel.Slide>A</CardCarousel.Slide>
          <CardCarousel.Slide>B</CardCarousel.Slide>
        </CardCarousel.Track>
        <CardCarousel.Indicators />
      </CardCarousel.Root>,
    );
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual(["Card 1", "Card 2"]);
  });

  it("lands on the last slide when slides go away", () => {
    const onIndexChange = vi.fn<(index: number) => void>();
    const { rerender } = render(
      <CardCarousel.Root snap={false} defaultIndex={2} onIndexChange={onIndexChange}>
        <CardCarousel.Track>
          {["A", "B", "C"].map((n) => (
            <CardCarousel.Slide key={n}>{n}</CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Root>,
    );
    rerender(
      <CardCarousel.Root snap={false} defaultIndex={2} onIndexChange={onIndexChange}>
        <CardCarousel.Track>
          {["A"].map((n) => (
            <CardCarousel.Slide key={n}>{n}</CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Root>,
    );
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    expect(slides()[0]!.hasAttribute("data-active")).toBe(true);
  });

  it("lays slides out as a coverflow, in 2D, unless the effect is off", () => {
    render(<Example />);
    const style = slides()[1]!.style;
    expect(style.transform).toContain("translateX(calc(var(--slide-offset)");
    expect(style.transform).toContain("skewY(");
    expect(style.transform).not.toMatch(/rotateY|perspective|translateZ/);
    expect(style.gridArea).toContain("1");
    expect(slides()[1]!.style.zIndex).toBe("90");
    cleanup();
    render(<Example effect="none" />);
    expect(slides()[1]!.style.transform).toBe("");
    expect(slides()[1]!.style.getPropertyValue("--slide-offset")).toBe("1");
  });

  it("drops the turn and depth, but not the fade, for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Example turn={1} depth={0.1} fade={0.4} />);
    const root = document.querySelector('[data-slot="carousel"]') as HTMLElement;
    expect(root.style.getPropertyValue("--carousel-turn")).toBe("0");
    expect(root.style.getPropertyValue("--carousel-depth")).toBe("0");
    expect(root.style.getPropertyValue("--carousel-fade")).toBe("0.4");
  });

  it("never writes whole slides over the moving offset when it re-renders mid-glide", () => {
    let frame: FrameRequestCallback | undefined;
    let now = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => ((frame = cb), 1));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { rerender } = render(
      <CardCarousel.Root>
        <CardCarousel.Viewport>
          <CardCarousel.Track>
            {NAMES.map((n) => (
              <CardCarousel.Slide key={n}>{n}</CardCarousel.Slide>
            ))}
          </CardCarousel.Track>
        </CardCarousel.Viewport>
      </CardCarousel.Root>,
    );
    fireEvent.keyDown(region(), { key: "ArrowRight" });
    act(() => {
      now = 80;
      frame?.(now);
    });
    const mid = slides()[1]!.style.getPropertyValue("--slide-offset");
    expect(Number(mid)).toBeGreaterThan(0);
    expect(Number(mid)).toBeLessThan(1);
    // The owner re-renders while it moves: the offset stays where the glide put it.
    rerender(
      <CardCarousel.Root className="again">
        <CardCarousel.Viewport>
          <CardCarousel.Track>
            {NAMES.map((n) => (
              <CardCarousel.Slide key={n}>{n}</CardCarousel.Slide>
            ))}
          </CardCarousel.Track>
        </CardCarousel.Viewport>
      </CardCarousel.Root>,
    );
    expect(slides()[1]!.style.getPropertyValue("--slide-offset")).toBe(mid);
  });
});
