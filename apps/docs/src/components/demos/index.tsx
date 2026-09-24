import { lazy, type LazyExoticComponent, type ComponentType } from "react";

// Each demo, and its source for the Code tab, loads only on the page that shows it.
type Demo = {
  Component: LazyExoticComponent<ComponentType>;
  source: () => Promise<string>;
  file: string;
};

const demo = <M,>(
  load: () => Promise<M>,
  pick: (m: M) => ComponentType,
  source: () => Promise<{ default: string }>,
  file: string,
): Demo => ({
  Component: lazy(() => load().then((m) => ({ default: pick(m) }))),
  source: () => source().then((m) => m.default),
  file,
});

export const demos = {
  playground: demo(
    () => import("../../../registry/cardstock/card-playground"),
    (m) => m.CardPlayground,
    () => import("../../../registry/cardstock/card-playground.tsx?raw"),
    "card-playground.tsx",
  ),
  "payment-card": demo(
    () => import("./payment-card-demo"),
    (m) => m.PaymentCardDemo,
    () => import("./payment-card-demo.tsx?raw"),
    "payment-card-demo.tsx",
  ),
  "css-card": demo(
    () => import("./css-card"),
    (m) => m.CssCard,
    () => import("./css-card.tsx?raw"),
    "css-card.tsx",
  ),
  "motion-card": demo(
    () => import("./motion-card"),
    (m) => m.MotionCard,
    () => import("./motion-card.tsx?raw"),
    "motion-card.tsx",
  ),
  swiper: demo(
    () => import("./swiper-demo"),
    (m) => m.SwiperDemo,
    () => import("./swiper-demo.tsx?raw"),
    "swiper-demo.tsx",
  ),
  limit: demo(
    () => import("./limit-demo"),
    (m) => m.LimitDemo,
    () => import("./limit-demo.tsx?raw"),
    "limit-demo.tsx",
  ),
} satisfies Record<string, Demo>;

export type DemoName = keyof typeof demos;
