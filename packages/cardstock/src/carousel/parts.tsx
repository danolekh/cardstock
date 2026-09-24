"use client";
import type * as React from "react";
import { useEffect, useRef } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCardCarousel } from "./context";
import { rubberBand } from "./physics";

export interface CardCarouselViewportProps extends PartProps<"div", Record<string, unknown>> {}

/** The carousel region: labelled for assistive tech, with ←/→ between slides. Give it an
 * `aria-label`. Renders a `<div>`. */
export function CardCarouselViewport(props: CardCarouselViewportProps): React.ReactElement {
  const { index, setIndex } = useCardCarousel();
  return usePart("carousel-viewport", "div", {}, props, {
    role: "region",
    "aria-roledescription": "carousel",
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex(index - 1);
      else if (e.key === "ArrowRight") setIndex(index + 1);
      else return;
      e.preventDefault();
    },
  });
}

export interface CardCarouselTrackState extends Record<string, unknown> {
  dragging: boolean;
}
export interface CardCarouselTrackProps extends PartProps<"div", CardCarouselTrackState> {
  /** Speed in px/s that counts as a flick. */
  flickVelocity?: number;
  /** Share of the finger's travel the track follows past either end. */
  elastic?: number;
}

/** The surface you drag. It follows the finger 1:1 (one slide per its own width), rubber-bands
 * at the ends, and on release lands on the slide the speed points to. The click that ends a drag
 * is swallowed, so a swipe never presses anything on a slide. Renders a `<div>`. */
export function CardCarouselTrack(props: CardCarouselTrackProps): React.ReactElement {
  const { flickVelocity = 500, elastic = 0.18, ...rest } = props;
  const { count, position, dragging, drag } = useCardCarousel();
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    from: number;
    width: number;
    active: boolean;
    samples: [t: number, x: number][];
  } | null>(null);
  const swallowClick = useRef(false);

  return usePart("carousel-track", "div", { dragging }, rest, {
    style: { touchAction: "pan-y" },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || count < 2) return;
      swallowClick.current = false;
      gesture.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        from: position.get(),
        width: e.currentTarget.clientWidth || 1,
        active: false,
        samples: [[e.timeStamp, e.clientX]],
      };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      if (!g.active) {
        if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(e.clientY - g.y)) return;
        g.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.start();
      }
      g.samples = [...g.samples.filter(([t]) => e.timeStamp - t < 100), [e.timeStamp, e.clientX]];
      drag.move(rubberBand(g.from - dx / g.width, count, elastic));
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => end(e),
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => end(e),
    onClickCapture: (e: React.MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  });

  function end(e: React.PointerEvent<HTMLElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !g.active) return;
    swallowClick.current = true;
    const [t0, x0] = g.samples[0] ?? [e.timeStamp, e.clientX];
    const dt = (e.timeStamp - t0) / 1000;
    const pxPerSecond = dt > 0 ? (e.clientX - x0) / dt : 0;
    // Dragging left moves towards later slides, so the speed in slides flips sign.
    drag.end(-pxPerSecond / g.width, flickVelocity / g.width);
  }
}

export interface CardCarouselSlideState extends Record<string, unknown> {
  active: boolean;
}
export interface CardCarouselSlideProps extends PartProps<"div", CardCarouselSlideState> {
  index: number;
  /** A click on a slide that isn't current makes it current. */
  selectOnClick?: boolean;
}

/** One slide. Every frame it writes its distance from the middle, in slides:
 * `--slide-offset` (signed), `--slide-offset-clamped` (-1..1) and `--slide-distance` (0..1).
 * Position and turn it with those, e.g.
 * `translate: calc(var(--slide-offset) * (100% + 16px)); rotate: y calc(var(--slide-offset-clamped) * -24deg)`.
 * A slide that isn't current is hidden from assistive tech. Renders a `<div>`. */
export function CardCarouselSlide(props: CardCarouselSlideProps): React.ReactElement {
  const { index: slideIndex, selectOnClick = true, ...rest } = props;
  const { index, count, setIndex, position, register } = useCardCarousel();
  const ref = useRef<HTMLElement>(null);
  const active = slideIndex === index;

  useEffect(() => register(slideIndex), [register, slideIndex]);
  useEffect(() => {
    const write = (p: number) => {
      const offset = slideIndex - p;
      const el = ref.current;
      if (!el) return;
      el.style.setProperty("--slide-offset", String(offset));
      el.style.setProperty("--slide-offset-clamped", String(Math.max(-1, Math.min(1, offset))));
      el.style.setProperty("--slide-distance", String(Math.min(1, Math.abs(offset))));
    };
    write(position.get());
    return position.subscribe(write);
  }, [position, slideIndex]);

  const offset = slideIndex - index;
  return usePart(
    "carousel-slide",
    "div",
    { active },
    rest,
    {
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": `${slideIndex + 1} of ${count}`,
      "aria-hidden": active ? undefined : true,
      style: {
        "--slide-offset": offset,
        "--slide-offset-clamped": Math.max(-1, Math.min(1, offset)),
        "--slide-distance": Math.min(1, Math.abs(offset)),
      } as React.CSSProperties,
      onClick: () => {
        if (!active && selectOnClick) setIndex(slideIndex);
      },
    },
    [ref as React.Ref<never>],
  );
}

export interface CardCarouselButtonState extends Record<string, unknown> {
  disabled: boolean;
}
export interface CardCarouselButtonProps extends PartProps<"button", CardCarouselButtonState> {}

function useStep(slot: string, step: -1 | 1, label: string, props: CardCarouselButtonProps) {
  const { index, count, setIndex } = useCardCarousel();
  const disabled = step < 0 ? index <= 0 : index >= count - 1;
  return usePart(slot, "button", { disabled }, props as never, {
    type: "button",
    "aria-label": label,
    disabled,
    onClick: () => setIndex(index + step),
  });
}

/** Goes to the previous slide; disabled on the first. Renders a `<button>`. */
export function CardCarouselPrevious(props: CardCarouselButtonProps): React.ReactElement {
  return useStep("carousel-previous", -1, "Previous card", props);
}

/** Goes to the next slide; disabled on the last. Renders a `<button>`. */
export function CardCarouselNext(props: CardCarouselButtonProps): React.ReactElement {
  return useStep("carousel-next", 1, "Next card", props);
}

export interface CardCarouselIndicatorState extends Record<string, unknown> {
  active: boolean;
}
export interface CardCarouselIndicatorProps extends PartProps<"button", CardCarouselIndicatorState> {
  index: number;
}

/** A dot, tab or label for one slide; pressing it goes there. Renders a `<button>` with
 * `aria-current` on the current slide. */
export function CardCarouselIndicator(props: CardCarouselIndicatorProps): React.ReactElement {
  const { index: target, ...rest } = props;
  const { index, setIndex } = useCardCarousel();
  const active = target === index;
  return usePart("carousel-indicator", "button", { active }, rest as never, {
    type: "button",
    "aria-label": `Go to card ${target + 1}`,
    "aria-current": active ? "true" : undefined,
    onClick: () => setIndex(target),
  });
}
