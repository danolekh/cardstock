"use client";
import type * as React from "react";
import { Children, useRef } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useIsoLayoutEffect } from "../utils/use-iso-layout-effect";
import {
  SlideIndexContext,
  TrackCountContext,
  useCardCarousel,
  useCarouselDragging,
  useCarouselMotion,
} from "./context";
import { coverflowTrack } from "./effect";
import { releaseVelocity, rubberBand } from "./physics";

export interface CardCarouselTrackState extends Record<string, unknown> {
  dragging: boolean;
}
export interface CardCarouselTrackProps extends PartProps<"div", CardCarouselTrackState> {
  /** @deprecated Set `flickVelocity` on the root. */
  flickVelocity?: number;
  /** @deprecated Set `elastic` on the root. */
  elastic?: number;
}

/** The surface you drag, holding the slides. Its children are counted and numbered in order, so
 * slides need no `index`. It follows the finger 1:1 (one slide per slide width plus the gap),
 * rubber-bands at the ends, and on release lands on the slide the speed points to. The click that
 * ends a drag is swallowed, so a swipe never presses anything on a slide; a click on a slide that
 * isn't current makes it current. Renders a `<div>`. */
export function CardCarouselTrack(props: CardCarouselTrackProps): React.ReactElement {
  const { flickVelocity: flickProp, elastic: elasticProp, children, ...rest } = props;
  const { index, count, setIndex, effect, dir } = useCardCarousel();
  const direction = dir === "rtl" ? -1 : 1;
  const {
    motion,
    gap,
    flickVelocity: flickRoot,
    elastic: elasticRoot,
    setCount,
    slides,
    release,
  } = useCarouselMotion();
  const dragging = useCarouselDragging();
  const flickVelocity = flickProp ?? flickRoot;
  const elastic = elasticProp ?? elasticRoot;

  const items = Children.toArray(children);
  useIsoLayoutEffect(() => setCount(items.length), [items.length, setCount]);

  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    from: number;
    step: number;
    active: boolean;
    samples: [t: number, x: number][];
  } | null>(null);
  const swallowClick = useRef(false);
  const n = count ?? items.length;

  const end = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !g.active) return;
    swallowClick.current = true;
    motion.setDragging(false);
    g.samples.push([performance.now(), e.clientX]);
    // Dragging towards the start of the line moves to later slides, so the speed flips sign.
    release((-releaseVelocity(g.samples) * direction) / g.step, flickVelocity / g.step);
  };

  const element = usePart("carousel-track", "div", { dragging }, rest, {
    style: { touchAction: "pan-y", ...(effect === "coverflow" ? coverflowTrack(dragging) : undefined) },
    "aria-live": "polite",
    children: (
      <TrackCountContext.Provider value={items.length}>
        {items.map((child, i) => (
          <SlideIndexContext.Provider key={keyOf(child, i)} value={i}>
            {child}
          </SlideIndexContext.Provider>
        ))}
      </TrackCountContext.Provider>
    ),
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || n < 2) return;
      swallowClick.current = false;
      // One slide of travel: the current slide's width (untransformed) plus the gap.
      const width = slides.get(index)?.el.offsetWidth || e.currentTarget.clientWidth || 1;
      gesture.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        from: motion.position.get(),
        step: width + gap,
        active: false,
        samples: [[performance.now(), e.clientX]],
      };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      if (!g.active) {
        if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(e.clientY - g.y)) return;
        g.active = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // A synthetic or already-released pointer: the drag works without capture.
        }
        motion.cancel();
        motion.setDragging(true);
      }
      const now = performance.now();
      g.samples = [...g.samples.filter(([t]) => now - t < 100), [now, e.clientX]];
      motion.publish(rubberBand(g.from - (dx * direction) / g.step, n, elastic));
    },
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture: (e: React.MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    // Slides out of focus are inert, so they can't take a click themselves: find the one under
    // the pointer, nearest the middle first.
    onClick: (e: React.MouseEvent) => {
      const current = slides.get(index)?.el;
      if (current?.contains(e.target as Node)) return;
      const hits = [...slides.entries()]
        .filter(([i, s]) => i !== index && s.selectOnClick && contains(s.el, e.clientX, e.clientY))
        .sort(([a], [b]) => Math.abs(a - index) - Math.abs(b - index));
      if (hits[0]) setIndex(hits[0][0]);
    },
  });
  return element;
}

const keyOf = (child: ReturnType<typeof Children.toArray>[number], i: number) =>
  typeof child === "object" && child !== null && "key" in child && child.key != null ? child.key : i;

function contains(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
