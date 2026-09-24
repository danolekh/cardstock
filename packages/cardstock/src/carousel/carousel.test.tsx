import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardCarousel } from "./index";

afterEach(cleanup);

function Example(props: React.ComponentProps<typeof CardCarousel.Root>) {
  return (
    <CardCarousel.Root snap={false} {...props}>
      <CardCarousel.Viewport aria-label="Cards" tabIndex={0}>
        <CardCarousel.Track>
          {["A", "B", "C"].map((name, i) => (
            <CardCarousel.Slide key={name} index={i}>
              {name}
            </CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Viewport>
      <CardCarousel.Previous />
      <CardCarousel.Next />
    </CardCarousel.Root>
  );
}

const slides = () => [...document.querySelectorAll('[data-slot="carousel-slide"]')] as HTMLElement[];

describe("CardCarousel", () => {
  it("is an APG carousel with labelled slides", () => {
    render(<Example />);
    expect(screen.getByRole("region", { name: "Cards" }).getAttribute("aria-roledescription")).toBe(
      "carousel",
    );
    expect(slides()[1]?.getAttribute("aria-label")).toBe("2 of 3");
    expect(slides()[1]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("moves with the arrow keys and writes each slide's offset", () => {
    const onIndexChange = vi.fn<(index: number) => void>();
    render(<Example onIndexChange={onIndexChange} />);
    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(slides()[1]?.hasAttribute("data-active")).toBe(true);
    expect(slides()[0]?.style.getPropertyValue("--slide-offset")).toBe("-1");
    expect(slides()[2]?.style.getPropertyValue("--slide-distance")).toBe("1");
  });

  it("disables Previous on the first card and Next on the last", () => {
    render(<Example defaultIndex={2} />);
    expect((screen.getByRole("button", { name: "Next card" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous card" }));
    expect(slides()[1]?.hasAttribute("data-active")).toBe(true);
  });

  it("selects a neighbour when it is clicked", () => {
    render(<Example />);
    fireEvent.click(slides()[1]!);
    expect(slides()[1]?.hasAttribute("data-active")).toBe(true);
  });
});
