"use client";
import { CardCarousel } from "@danolekh/cardstock/carousel";
import type * as React from "react";

/* Swipe between cards, the way banking apps do: the track follows the finger, a release snaps on
 * a spring that keeps the flick's speed, and the cards beside the middle one stand turned away and
 * a little back. That look is the carousel's own coverflow; tune it with `gap`, `turn`, `depth`
 * and `fade` on the root, or pass `effect="none"` and move the slides by their CSS variables. */

export interface CardSwiperProps {
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** One label per card, read out as "Premium, 2 of 4" and shown on the tabs. */
  labels: string[];
  children: (index: number, active: boolean) => React.ReactNode;
  /** Render the tabs under the carousel. */
  tabs?: boolean;
  className?: string;
}

export function CardSwiper({
  labels,
  children,
  tabs = true,
  className,
  ...root
}: CardSwiperProps): React.ReactElement {
  return (
    <CardCarousel.Root {...root} count={labels.length} className={`w-full ${className ?? ""}`}>
      <CardCarousel.Viewport className="focus-visible:ring-ring mx-auto w-full max-w-[380px] rounded-2xl outline-none focus-visible:ring-2">
        <CardCarousel.Track>
          {labels.map((label) => (
            <CardCarousel.Slide key={label} label={label}>
              {({ index, active }) => children(index, active)}
            </CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Viewport>
      {tabs && (
        <CardCarousel.Indicators className="mt-5 flex flex-wrap justify-center gap-1.5">
          {labels.map((label) => (
            <CardCarousel.Indicator
              key={label}
              className="border-border hover:text-foreground data-active:border-foreground data-active:bg-foreground data-active:text-background focus-visible:ring-ring rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-2"
            >
              {label}
            </CardCarousel.Indicator>
          ))}
        </CardCarousel.Indicators>
      )}
    </CardCarousel.Root>
  );
}
