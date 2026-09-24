import { Switch } from "@base-ui/react/switch";
import type * as React from "react";
import { useEffect, useState } from "react";

import { CardSwiper } from "../../docs/registry/cardstock/card-carousel";
import { PaymentCard } from "../../docs/registry/cardstock/payment-card";
import { BACKGROUNDS, type BackgroundName } from "../../docs/src/lib/backgrounds";

/* What the recorder films: the docs' own swiper and payment cards on the site's paper, with one
 * freeze switch for the card in the middle. Nothing else on the page. */

const DEMO = {
  number: "4821 5903 2716 4822",
  holder: "Max Mustermann",
  expiry: "09/29",
  securityCode: "731",
};

// A gradient first, then the artwork.
const CARDS: BackgroundName[] = ["ink", "holo", "guilloche", "aurora", "topo"];

// The artwork's srcs are root-relative, and vite.config.ts serves the docs' public folder here.

export function Stage(): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [frozen, setFrozen] = useState<ReadonlySet<number>>(new Set());
  const freeze = (on: boolean) =>
    setFrozen((s) => {
      const next = new Set(s);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });

  useEffect(() => {
    // Fonts and artwork in, then the recorder may start.
    const images = CARDS.map((k) => BACKGROUNDS[k]).flatMap((bg) => {
      if (bg.type !== "image") return [];
      const img = new Image();
      img.src = bg.src;
      return [img.decode().catch(() => {})];
    });
    void Promise.all([document.fonts.ready, ...images]).then(() =>
      document.documentElement.setAttribute("data-ready", ""),
    );
  }, []);

  return (
    <main className="flex h-full w-full flex-col items-center justify-center">
      <div className="w-[380px]">
        <CardSwiper
          index={index}
          onIndexChange={setIndex}
          labels={CARDS.map((k) => BACKGROUNDS[k].label)}
          tabs={false}
        >
          {(i, active) => (
            <PaymentCard
              {...DEMO}
              background={BACKGROUNDS[CARDS[i]!]}
              active={active}
              frozen={frozen.has(i)}
              onFrozenChange={(on) => (active ? freeze(on) : undefined)}
              spent={842}
              limit={1200}
            />
          )}
        </CardSwiper>
        <div className="text-fd-muted-foreground mt-7 flex items-center justify-between text-[15px]">
          {/* Both labels in one grid cell, so the swap never moves anything. */}
          <span className="grid">
            <span className={`[grid-area:1/1] ${frozen.has(index) ? "invisible" : ""}`}>Freeze card</span>
            <span className={`text-sky-700 [grid-area:1/1] ${frozen.has(index) ? "" : "invisible"}`}>
              ❄ Frozen · payments paused
            </span>
          </span>
          <Switch.Root
            data-stage="freeze"
            checked={frozen.has(index)}
            onCheckedChange={freeze}
            className="border-fd-border bg-fd-muted data-checked:bg-fd-primary relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors data-checked:border-transparent"
          >
            <Switch.Thumb className="size-[22px] rounded-full bg-white shadow transition-transform duration-200 data-checked:translate-x-5" />
          </Switch.Root>
        </div>
      </div>
    </main>
  );
}
