import { Switch } from "@base-ui/react/switch";
import { type CardBackground, shaderBackground } from "@danolekh/cardstock";
import { defineShader, ShaderLibrary } from "@danolekh/cardstock/shader";
import type * as React from "react";
import { useEffect, useState } from "react";

import { CardSwiper } from "../../../docs/registry/cardstock/card-carousel";
import { LimitField } from "../../../docs/registry/cardstock/limit-field";
import { PaymentCard } from "../../../docs/registry/cardstock/payment-card";
import { api, useReady } from "../common";
import { RB_SHADERS } from "./shaders";

/* The whole library on cards in Raiffeisen's style, for the pitch video: a swiper of six live
 * shader cards (quiet yellow up to the premium moiré, with two of cardstock's own presets in the
 * brand's green and porcelain), the controls beside them, captions for each beat, a brand shader
 * typed in live, and a closing card. A design concept: the cards carry cardstock's wordmark, never
 * the bank's logo. */

const DEMO = {
  number: "4821 5903 2716 4822",
  holder: "Max Mustermann",
  expiry: "09/29",
  securityCode: "731",
};
const SPENT = 842;

type Named = CardBackground & { label: string };
const rb = (
  shader: string,
  label: string,
  rest: Omit<Named, "type" | "label" | "shader" | "color"> & {
    color: string;
  },
): Named => ({ type: "shader", shader, label, ...rest }) as Named;

const CARDS: readonly Named[] = [
  rb("rb/classic", "Classic", { color: "#fbf315", tone: "light", ink: "#161616" }),
  rb("rb/gable", "Gold", { color: "#1a1810", tone: "dark", ink: "#fbf315" }),
  rb("rb/arrows", "Business", { color: "#23211d", tone: "dark", ink: "#f4f1e8" }),
  {
    ...shaderBackground("silk", {
      color: "#057a2f",
      tone: "dark",
      ink: "#ffffff",
      params: { colors: ["#03561f", "#057a2f", "#16a64c", "#fbf315"], turbulence: 0.55 },
    }),
    label: "Green",
  },
  {
    ...shaderBackground("liquid-metal", {
      color: "#e6e8ee",
      tone: "light",
      ink: "#161616",
      params: { tint: "#eceef5", bands: 2.6 },
    }),
    label: "Porcelain",
  },
  rb("rb/premium", "Premium", { color: "#0b0a08", tone: "dark", ink: "#f1dfa6" }),
];

// The brand shader typed in during the video: yellow waves running along the diagonal.
const SOURCE =
  "vec2 p=(FC.xy*2.-r)/r.y+uTilt*.25;float d=p.x+p.y,v=sin(d*8.-t*1.6+sin(p.x*2.+t*.7)*1.4);o=vec4(mix(vec3(.07,.07,.05),vec3(.98,.95,.08),smoothstep(.55,1.,v)),1);";
const OWN = defineShader({ id: "rb/waves", label: "Waves", dialect: "twigl", source: SOURCE });
const OWN_BG: Named = rb("rb/waves", "Waves", { color: "#141410", tone: "dark", ink: "#fbf315" });
const SHADERS = [...RB_SHADERS, OWN];

const eur = (n: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function RaiffeisenShowcase(): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [frozen, setFrozen] = useState<ReadonlySet<number>>(new Set());
  const [limit, setLimit] = useState(1200);
  const [caption, setCaption] = useState<string | null>(null);
  const [typed, setTyped] = useState(-1);
  const [own, setOwn] = useState(false);
  const [ended, setEnded] = useState(false);
  const isFrozen = frozen.has(index);
  useReady(CARDS.slice(0, 1));

  useEffect(() => {
    api.caption = setCaption;
    api.end = () => setEnded(true);
    api.byo = () => {
      setTyped(0);
      // A few characters a frame: a quick paste-and-tweak, not slow typing.
      const id = setInterval(() => {
        setTyped((n) => {
          const next = Math.min(SOURCE.length, n + 3);
          if (next === SOURCE.length) {
            clearInterval(id);
            setTimeout(() => setOwn(true), 250);
          }
          return next;
        });
      }, 16);
    };
  }, []);

  const choose = (i: number) => {
    setIndex(i);
    setFlipped(false);
    setRevealed(false);
  };
  const freeze = (on: boolean) =>
    setFrozen((s) => {
      const next = new Set(s);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });
  const coding = typed >= 0;

  return (
    <ShaderLibrary shaders={SHADERS}>
      <main className="relative isolate flex h-full w-full items-center justify-center gap-8 px-8">
        {/* The swiper keeps to its column: its neighbours peek in at the edges and fade out, rather
            than turning over the controls. */}
        <div className="-my-10 w-[430px] shrink-0 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_7%,black_93%,transparent)] px-[25px] py-10">
          <CardSwiper index={index} onIndexChange={choose} labels={CARDS.map((c) => c.label)} tabs={false}>
            {(i, active) => (
              <PaymentCard
                {...DEMO}
                background={own && active ? OWN_BG : CARDS[i]}
                active={active}
                flipped={active && flipped}
                onFlippedChange={active ? setFlipped : undefined}
                revealed={active && revealed}
                onRevealedChange={setRevealed}
                frozen={frozen.has(i)}
                onFrozenChange={(on) => (active ? freeze(on) : undefined)}
                spent={SPENT}
                limit={limit}
              />
            )}
          </CardSwiper>
          <p className="text-fd-muted-foreground mt-5 flex justify-between px-1 text-[13px]">
            <span className="grid">
              <span className={`[grid-area:1/1] ${isFrozen ? "invisible" : ""}`}>
                {(own ? OWN_BG : CARDS[index])!.label} · this month
              </span>
              <span className={`text-sky-700 [grid-area:1/1] ${isFrozen ? "" : "invisible"}`}>
                ❄ Frozen · payments paused
              </span>
            </span>
            <span className="tabular-nums">
              {eur(SPENT)} of {eur(limit)}
            </span>
          </p>
        </div>

        <div className="relative w-[300px] shrink-0">
          {/* The controls, and in their place for the last beat, the shader being typed in. */}
          <div
            className={`border-fd-border bg-fd-card space-y-4 rounded-2xl border p-5 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.3)] transition-opacity duration-300 ${coding ? "pointer-events-none opacity-0" : ""}`}
          >
            <div className="text-fd-muted-foreground flex items-center justify-between gap-3 text-sm">
              <span id="stage-freeze">Freeze card</span>
              <Switch.Root
                data-stage="freeze"
                aria-labelledby="stage-freeze"
                checked={isFrozen}
                onCheckedChange={freeze}
                className="border-fd-border bg-fd-muted relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors data-checked:border-transparent data-checked:bg-[#161616]"
              >
                <Switch.Thumb className="size-[18px] rounded-full bg-white shadow transition-transform duration-200 data-checked:translate-x-5 data-checked:bg-[#fbf315]" />
              </Switch.Root>
            </div>
            <div data-stage="limit">
              <LimitField value={limit} onValueChange={setLimit} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button data-stage="flip" onClick={() => setFlipped((f) => !f)}>
                <Stable on={flipped} yes="Front" no="Back" />
              </Button>
              <Button data-stage="reveal" onClick={() => setRevealed((r) => !r)} disabled={isFrozen}>
                <Stable on={revealed} yes="Hide details" no="Show details" />
              </Button>
            </div>
          </div>
          <pre
            className={`border-fd-border bg-fd-card absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-5 font-mono text-[10.5px] leading-[1.7] whitespace-pre-wrap text-[#1c1a17] shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)] transition-opacity duration-300 ${coding ? "" : "pointer-events-none opacity-0"}`}
          >
            <span className="text-[#b45309]">const</span> waves ={" "}
            <span className="text-[#3b5bdb]">defineShader</span>({"{\n"}
            {"  "}id: <span className="text-[#6f8a2e]">"rb/waves"</span>,{"\n"}
            {"  "}dialect: <span className="text-[#6f8a2e]">"twigl"</span>,{"\n"}
            {"  "}source: <span className="text-[#6f8a2e]">`</span>
            <span className="break-all">{coding ? SOURCE.slice(0, typed) : ""}</span>
            {coding && typed < SOURCE.length ? (
              <span className="inline-block h-[1.1em] w-[0.5em] bg-[#161616] align-middle" />
            ) : null}
            <span className="text-[#6f8a2e]">`</span>,{"\n"}
            {"});"}
          </pre>
        </div>

        {/* A caption per beat, low on the stage. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center">
          <span
            className={`rounded-full bg-[#161616] px-4 py-1.5 text-[13px] font-medium tracking-[0.01em] text-[#fbf315] transition-[opacity,translate] duration-300 ${caption ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
          >
            {caption ?? " "}
          </span>
        </div>

        {/* The closing card. */}
        <div
          className={`bg-fd-background absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 transition-opacity duration-500 ${ended ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <span className="text-[40px] leading-none font-extrabold tracking-tight">cardstock</span>
          <span className="text-fd-muted-foreground text-[17px]">
            Headless bank-card primitives for React
          </span>
          <span className="mt-2 rounded-full bg-[#161616] px-4 py-1.5 text-[14px] font-medium text-[#fbf315]">
            cardstock.danolekh.com
          </span>
          <span className="text-fd-muted-foreground mt-6 text-[11px]">
            A design concept in Raiffeisen’s colours · not affiliated with Raiffeisen
          </span>
        </div>
      </main>
    </ShaderLibrary>
  );
}

function Button(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="border-fd-border hover:bg-fd-accent rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
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
