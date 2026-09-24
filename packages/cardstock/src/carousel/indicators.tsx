"use client";
import type * as React from "react";
import { Children, createContext, useContext, useRef } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useIsoLayoutEffect } from "../utils/use-iso-layout-effect";
import { TrackCountContext, useCardCarousel, useCarouselMotion } from "./context";

export interface CardCarouselIndicatorsState extends Record<string, unknown> {
  index: number;
}
export interface CardCarouselIndicatorsProps extends PartProps<"div", CardCarouselIndicatorsState> {}

export interface CardCarouselIndicatorState extends Record<string, unknown> {
  active: boolean;
}
export interface CardCarouselIndicatorProps extends PartProps<"button", CardCarouselIndicatorState> {
  /** The slide it goes to. By default its order among the indicators' children. */
  index?: number;
}

const IndicatorIndexContext = createContext<number | undefined>(undefined);
const InTablistContext = createContext(false);

/** The indicators as a set of tabs, one per slide: ←/→ and Home/End move between them, and each
 * tab's slide is its panel. With no children it renders a plain `Indicator` for every slide.
 * Renders a `<div role="tablist">`. */
export function CardCarouselIndicators(props: CardCarouselIndicatorsProps): React.ReactElement {
  const { children, ...rest } = props;
  const { index, count, setIndex, dir, labels, tabId } = useCardCarousel();
  const { setTabs } = useCarouselMotion();
  const trackCount = useContext(TrackCountContext);
  const n = count ?? trackCount ?? 0;
  const ref = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    setTabs(true);
    return () => setTabs(false);
  }, [setTabs]);

  const items =
    children === undefined
      ? Array.from({ length: n }, (_, i) => <CardCarouselIndicator key={i} />)
      : Children.toArray(children);

  const go = (next: number) => {
    const target = Math.max(0, Math.min(n - 1, next));
    setIndex(target);
    ref.current?.ownerDocument.getElementById(tabId(target))?.focus();
  };

  return usePart(
    "carousel-indicators",
    "div",
    { index },
    rest,
    {
      role: "tablist",
      "aria-label": labels.indicators,
      children: (
        <InTablistContext.Provider value={true}>
          {items.map((child, i) => (
            <IndicatorIndexContext.Provider key={i} value={i}>
              {child}
            </IndicatorIndexContext.Provider>
          ))}
        </InTablistContext.Provider>
      ),
      onKeyDown: (e: React.KeyboardEvent) => {
        const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
        const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
        if (e.key === back) go(index - 1);
        else if (e.key === forward) go(index + 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(n - 1);
        else return;
        // Handled here, so the viewport around doesn't move a second time.
        e.preventDefault();
        e.stopPropagation();
      },
    },
    [ref as React.Ref<never>],
  );
}

/** A dot, tab or label for one slide; pressing it goes there. Inside `Indicators` it's a tab;
 * on its own, a `<button>` with `aria-current` on the current slide. */
export function CardCarouselIndicator(props: CardCarouselIndicatorProps): React.ReactElement {
  const { index: indexProp, children, ...rest } = props;
  const { index, count, setIndex, labels, slideId, tabId } = useCardCarousel();
  const order = useContext(IndicatorIndexContext);
  const inTablist = useContext(InTablistContext);
  const target = indexProp ?? order ?? 0;
  const active = target === index;
  const text = children === undefined ? { "aria-label": labels.indicator(target, count ?? target + 1) } : {};
  return usePart("carousel-indicator", "button", { active }, rest as never, {
    type: "button",
    children,
    ...text,
    ...(inTablist
      ? {
          id: tabId(target),
          role: "tab",
          "aria-selected": active,
          "aria-controls": slideId(target),
          tabIndex: active ? 0 : -1,
        }
      : { "aria-current": active ? "true" : undefined }),
    onClick: () => setIndex(target),
  });
}
