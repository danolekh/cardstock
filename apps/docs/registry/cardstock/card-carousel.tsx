"use client";
import { CardCarousel, useCardCarousel } from "@danolekh/cardstock/carousel";
import type * as React from "react";

/* Swipe between cards, the way banking apps do: the track follows the finger, a release snaps on
 * a spring that keeps the flick's speed, and the cards beside the middle one stand turned away and
 * a little back. The primitives only write each slide's offset; every transform below is CSS. */

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
    <CardCarousel.Root {...root} className={`w-full ${className ?? ""}`}>
      <CardCarousel.Viewport
        aria-label="Cards"
        tabIndex={0}
        className="focus-visible:ring-fd-ring mx-auto w-full max-w-[380px] rounded-2xl outline-none perspective-[1200px] focus-visible:ring-2"
      >
        <CardCarousel.Track className="relative grid cursor-grab transform-3d data-dragging:cursor-grabbing">
          {labels.map((label, i) => (
            <CardCarousel.Slide
              key={label}
              index={i}
              aria-label={`${label}, ${i + 1} of ${labels.length}`}
              className="[transform:translateX(calc(var(--slide-offset)*(100%+20px)))_translateZ(calc(var(--slide-distance)*-60px))_rotateY(calc(var(--slide-offset-clamped)*-24deg))_scale(calc(1-var(--slide-distance)*0.1))] [opacity:calc(1-var(--slide-distance)*0.4)] will-change-transform select-none [grid-area:1/1] transform-3d motion-reduce:[transform:translateX(calc(var(--slide-offset)*(100%+20px)))]"
            >
              <SlideContent index={i} render={children} />
            </CardCarousel.Slide>
          ))}
        </CardCarousel.Track>
      </CardCarousel.Viewport>
      {tabs && (
        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {labels.map((label, i) => (
            <CardCarousel.Indicator
              key={label}
              index={i}
              aria-label={label}
              className="border-fd-border hover:text-fd-foreground data-active:border-fd-foreground data-active:bg-fd-foreground data-active:text-fd-background rounded-full border px-3 py-1 text-sm transition-colors"
            >
              {label}
            </CardCarousel.Indicator>
          ))}
        </div>
      )}
    </CardCarousel.Root>
  );
}

function SlideContent({ index, render }: { index: number; render: CardSwiperProps["children"] }) {
  const { index: current } = useCardCarousel();
  return <>{render(index, index === current)}</>;
}
