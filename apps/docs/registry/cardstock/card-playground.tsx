"use client";
import { Switch } from "@base-ui/react/switch";
import type * as React from "react";
import { useState } from "react";

import { BACKGROUNDS, type BackgroundName } from "./backgrounds";
import { CardSwiper } from "./card-carousel";
import { LimitField } from "./limit-field";
import { PaymentCard } from "./payment-card";

/* Everything together: gradient and artwork backgrounds in the swiper, each card with its own freeze, one reveal and
 * flip for the card in the middle, and the limit. */

const KEYS: BackgroundName[] = [
  "ink",
  "holo",
  "guilloche",
  "paper",
  "aurora",
  "topo",
  "ember",
  "guilloche-sand",
];
const DEMO = {
  number: "4821 5903 2716 4822",
  holder: "Max Mustermann",
  expiry: "09/29",
  securityCode: "731",
};
const SPENT = 842;

export function CardPlayground(): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [frozen, setFrozen] = useState<ReadonlySet<BackgroundName>>(new Set());
  const [limit, setLimit] = useState(1200);
  const current = KEYS[index] ?? "ink";
  const isFrozen = frozen.has(current);

  const choose = (i: number) => {
    setIndex(i);
    setFlipped(false);
    setRevealed(false);
  };
  const freeze = (on: boolean) =>
    setFrozen((s) => {
      const next = new Set(s);
      if (on) next.add(current);
      else next.delete(current);
      return next;
    });

  return (
    <div className="not-prose border-fd-border bg-fd-card text-fd-card-foreground w-full overflow-hidden rounded-2xl border">
      <div className="px-6 py-10">
        <CardSwiper index={index} onIndexChange={choose} labels={KEYS.map((k) => BACKGROUNDS[k].label)}>
          {(i, active) => {
            const design = KEYS[i] ?? "ink";
            return (
              <PaymentCard
                {...DEMO}
                design={design}
                active={active}
                flipped={active && flipped}
                onFlippedChange={active ? setFlipped : undefined}
                revealed={active && revealed}
                onRevealedChange={setRevealed}
                frozen={frozen.has(design)}
                onFrozenChange={(on) => (active ? freeze(on) : undefined)}
                spent={SPENT}
                limit={limit}
              />
            );
          }}
        </CardSwiper>
        <p
          className="text-fd-muted-foreground mx-auto mt-4 flex max-w-[380px] justify-between text-sm"
          aria-live="polite"
        >
          {/* Both labels sit in one grid cell, so the swap never changes the line's size. */}
          <span className="grid">
            <span className={`[grid-area:1/1] ${isFrozen ? "invisible" : ""}`}>This month</span>
            <span
              className={`whitespace-nowrap text-sky-700 [grid-area:1/1] dark:text-sky-300 ${isFrozen ? "" : "invisible"}`}
            >
              ❄ Frozen<span className="max-sm:hidden"> · payments paused</span>
            </span>
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {eur(SPENT)} of {eur(limit)}
          </span>
        </p>
      </div>
      <div className="border-fd-border space-y-4 border-t border-dashed p-5">
        <div className="text-fd-muted-foreground flex items-center justify-between gap-3 text-sm">
          <span id="playground-freeze">Freeze card</span>
          <Switch.Root
            aria-labelledby="playground-freeze"
            checked={isFrozen}
            onCheckedChange={freeze}
            className="border-fd-border bg-fd-muted data-checked:bg-fd-primary relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors data-checked:border-transparent"
          >
            <Switch.Thumb className="size-[18px] rounded-full bg-white shadow transition-transform duration-200 data-checked:translate-x-5" />
          </Switch.Root>
        </div>
        <LimitField value={limit} onValueChange={setLimit} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => setFlipped((f) => !f)}>
            <Stable on={flipped} yes="Front" no="Back" />
          </Button>
          <Button onClick={() => setRevealed((r) => !r)} disabled={isFrozen} aria-pressed={revealed}>
            <Stable on={revealed} yes="Hide details" no="Show details" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const eur = (n: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function Button(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="border-fd-border hover:bg-fd-accent rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

// Both labels in one grid cell, so the button keeps the wider one's width.
function Stable({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span className="grid">
      <span className={`[grid-area:1/1] ${on ? "" : "invisible"}`}>{yes}</span>
      <span className={`[grid-area:1/1] ${on ? "invisible" : ""}`}>{no}</span>
    </span>
  );
}
