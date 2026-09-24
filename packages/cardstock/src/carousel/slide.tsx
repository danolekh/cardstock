"use client";
import type * as React from "react";
import { useContext, useMemo, useRef, useState } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useIsoLayoutEffect } from "../utils/use-iso-layout-effect";
import {
  type CarouselSlideState,
  SlideContext,
  SlideIndexContext,
  TrackCountContext,
  useCardCarousel,
  useCarouselMotion,
} from "./context";
import { COVERFLOW_SLIDE, slideVars, writeSlide } from "./effect";

export interface CardCarouselSlideState extends Record<string, unknown>, CarouselSlideState {
  /** Where it stands: before the current slide, the current one, or after it. */
  side: "previous" | "current" | "next";
}

export interface CardCarouselSlideProps extends Omit<PartProps<"div", CardCarouselSlideState>, "children"> {
  /** Its place in the carousel. By default its order among the track's children. */
  index?: number;
  /** A name read before its place, e.g. "Premium" → "Premium, 2 of 4". */
  label?: string;
  /** A click on it while it isn't current makes it current. */
  selectOnClick?: boolean;
  /** Content, or a function of the slide's state: `({ active }) => <Card active={active} />`. */
  children?: React.ReactNode | ((state: CarouselSlideState) => React.ReactNode);
}

/** One slide. Every frame it writes its distance from the middle, in slides: `--slide-offset`
 * (signed), `--slide-offset-clamped` (-1..1) and `--slide-distance` (0..1), which the built-in
 * look (or your own) moves it by. A slide that isn't current is inert: hidden from assistive tech
 * and out of the tab order, with nothing on it to press. Renders a `<div>`. */
export function CardCarouselSlide(props: CardCarouselSlideProps): React.ReactElement {
  const { index: indexProp, label, selectOnClick = true, children, ...rest } = props;
  const { index: current, count: counted, labels, effect, slideId, tabId, tabs } = useCardCarousel();
  const { motion, registerSlide } = useCarouselMotion();
  const order = useContext(SlideIndexContext);
  const trackCount = useContext(TrackCountContext);
  const index = indexProp ?? order ?? 0;
  const count = counted ?? trackCount ?? index + 1;
  const ref = useRef<HTMLElement>(null);
  const active = index === current;
  const offset = index - current;

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unregister = registerSlide(index, el, selectOnClick);
    const write = (p: number) => writeSlide(el, index - p, effect);
    write(motion.position.get());
    const unsubscribe = motion.position.subscribe(write);
    return () => {
      unsubscribe();
      unregister();
    };
  }, [index, effect, motion, registerSlide, selectOnClick]);

  // The moving variables are written every frame from the layout effect; React only ever sees
  // their first values, so a re-render can't snap them to whole slides mid-glide.
  const [initialVars] = useState(() => slideVars(offset));
  const state = useMemo<CarouselSlideState>(
    () => ({ index, count, active, offset }),
    [index, count, active, offset],
  );

  const element = usePart(
    "carousel-slide",
    "div",
    {
      ...state,
      side: offset < 0 ? "previous" : offset > 0 ? "next" : "current",
    } satisfies CardCarouselSlideState,
    rest as never,
    {
      id: slideId(index),
      // With indicators as tabs, each slide is the panel its tab names; otherwise a labelled group.
      role: tabs ? "tabpanel" : "group",
      "aria-roledescription": tabs ? undefined : "slide",
      "aria-label": tabs ? undefined : labels.slide(index, count, label),
      "aria-labelledby": tabs ? tabId(index) : undefined,
      "aria-hidden": active ? undefined : true,
      inert: !active,
      "data-index": index,
      "data-label": label,
      style: { ...initialVars, ...(effect === "coverflow" ? COVERFLOW_SLIDE : undefined) },
      children: (
        <SlideContext.Provider value={state}>
          {typeof children === "function" ? children(state) : children}
        </SlideContext.Provider>
      ),
    },
    [ref as React.Ref<never>],
  );
  return element;
}
