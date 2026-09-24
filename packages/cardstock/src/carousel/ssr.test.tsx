// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CardCarousel } from "./index";

const html = (props: React.ComponentProps<typeof CardCarousel.Root> = {}) =>
  renderToString(
    <CardCarousel.Root {...props}>
      <CardCarousel.Viewport>
        <CardCarousel.Track>
          {["Ink", "Paper", "Sage"].map((name) => (
            <CardCarousel.Slide key={name} label={name}>
              {name}
            </CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Viewport>
      <CardCarousel.Previous />
      <CardCarousel.Next />
    </CardCarousel.Root>,
  );

describe("server rendering", () => {
  it("numbers the slides from the track's children, with no count given", () => {
    const out = html();
    expect(out).toContain('aria-label="Ink, 1 of 3"');
    expect(out).toContain('aria-label="Sage, 3 of 3"');
    expect(out).toContain("--slide-offset:0");
    expect(out).toContain("--slide-offset:1");
    // Next can't know it's on the last slide yet, so it stays usable.
    expect(out).toMatch(/aria-label="Next card"(?![^>]*disabled)/);
  });

  it("disables Next on the last slide when the count is given", () => {
    const out = html({ count: 3, defaultIndex: 2 });
    expect(out).toMatch(
      /<button[^>]*disabled[^>]*aria-label="Next card"|<button[^>]*aria-label="Next card"[^>]*disabled/,
    );
  });
});
