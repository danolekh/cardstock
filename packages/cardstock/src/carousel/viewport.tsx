"use client";
import type * as React from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCardCarousel } from "./context";

export interface CardCarouselViewportProps extends PartProps<"div", Record<string, unknown>> {}

const typing = (el: EventTarget) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** The carousel region: labelled and focusable for assistive tech, with ←/→ (mirrored right to
 * left) between slides and Home/End to the ends. Keys typed into a field on a slide are left
 * alone. Renders a `<div>`. */
export function CardCarouselViewport(props: CardCarouselViewportProps): React.ReactElement {
  const { index, count, setIndex, dir, labels } = useCardCarousel();
  return usePart("carousel-viewport", "div", {}, props, {
    role: "region",
    "aria-roledescription": "carousel",
    "aria-label": labels.carousel,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target)) return;
      const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (e.key === back) setIndex(index - 1);
      else if (e.key === forward) setIndex(index + 1);
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End" && count !== undefined) setIndex(count - 1);
      else return;
      e.preventDefault();
    },
  });
}
