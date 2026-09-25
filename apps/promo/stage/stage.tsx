import { Switch } from "@base-ui/react/switch";
import type { CardBackground, CardFlipEffect } from "@danolekh/cardstock";
import { defineShader, ShaderLibrary } from "@danolekh/cardstock/shader";
import type * as React from "react";
import { useEffect, useState } from "react";

import { CardSwiper } from "../../docs/registry/cardstock/card-carousel";
import { PaymentCard } from "../../docs/registry/cardstock/payment-card";
import { BACKGROUNDS, type BackgroundName } from "../../docs/src/lib/backgrounds";

/* What the recorder films, on the site's paper with nothing else on the page:
 * - `?cards=a,b,c` (the default scene): the docs' own swiper and payment cards, with one freeze
 *   switch for the card in the middle;
 * - `?scene=byo`: your own shader, typed out beside the card it comes alive on.
 * The recorder drives the page through `window.__stage`. */

const DEMO = {
  number: "4821 5903 2716 4822",
  holder: "Max Mustermann",
  expiry: "09/29",
  securityCode: "731",
};

const params = new URLSearchParams(location.search);
// The artwork's srcs are root-relative, and vite.config.ts serves the docs' public folder here.
const CARDS = (params.get("cards")?.split(",") ?? [
  "ink",
  "holo",
  "guilloche",
  "aurora",
  "topo",
]) as BackgroundName[];

interface StageApi {
  setFlip?: (effect: CardFlipEffect) => void;
  start?: () => void;
}
const api = ((window as unknown as { __stage?: StageApi }).__stage ??= {});

/** Ready once fonts and artwork are in, and the shader in view has drawn a frame. */
function useReady(backgrounds: readonly CardBackground[]) {
  useEffect(() => {
    const loads = backgrounds.flatMap((bg) => {
      const src = bg.type === "image" ? bg.src : bg.type === "shader" ? bg.poster : undefined;
      if (!src) return [];
      const img = new Image();
      img.src = src;
      return [img.decode().catch(() => {})];
    });
    const shaders = () =>
      new Promise<void>((resolve) => {
        const check = () =>
          // Only the face in view on the card in focus: the others hold on their posters.
          [...document.querySelectorAll("[data-slot=card-front][data-visible] [data-slot=card-shader]")]
            .filter((c) => !c.closest("[data-slot=carousel-slide]:not([data-active])"))
            .every((c) => c.hasAttribute("data-ready") || c.hasAttribute("data-failed"))
            ? resolve()
            : setTimeout(check, 50);
        check();
      });
    void Promise.all([document.fonts.ready, ...loads])
      .then(shaders)
      .then(() => document.documentElement.setAttribute("data-ready", ""));
    // Once, for the first paint.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Stage(): React.ReactElement {
  return params.get("scene") === "byo" ? <OwnShader /> : <Swiper />;
}

function Swiper(): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<CardFlipEffect>("sheen");
  const [frozen, setFrozen] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    api.setFlip = setFlip;
  }, []);
  const freeze = (on: boolean) =>
    setFrozen((s) => {
      const next = new Set(s);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });
  useReady(CARDS.map((k) => BACKGROUNDS[k]));

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
              flip={flip}
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

// ——— Your own shader ————————————————————————————————————————————————————————————————————————

// An original twigl one-liner: warped water, navy to teal, leaning with the tilt.
const SOURCE =
  "vec2 p=(FC.xy*2.-r)/r.y+uTilt*.3;for(float i=1.;i<5.;i++)p+=sin(p.yx*i+t*.5)/i;float v=sin(length(p)*2.+t*.4)*.5+.5;o=vec4(mix(vec3(.04,.07,.16),vec3(.22,.52,.66),v),1);";

const TIDE = defineShader({ id: "acme/tide", label: "Tide", dialect: "twigl", source: SOURCE });

const PLAIN: CardBackground = BACKGROUNDS.ink;
const LIVE: CardBackground = { type: "shader", shader: "acme/tide", color: "#28406a", tone: "dark" };

const tone = { key: "text-[#d9482a]", str: "text-[#6f8a2e]", fn: "text-[#3b5bdb]" };

function OwnShader(): React.ReactElement {
  const [typed, setTyped] = useState(0);
  const [live, setLive] = useState(false);
  useReady([PLAIN]);
  useEffect(() => {
    api.start = () => {
      // A few characters a frame: a quick paste-and-tweak rather than slow typing.
      const id = setInterval(() => {
        setTyped((n) => {
          const next = Math.min(SOURCE.length, n + 3);
          if (next === SOURCE.length) {
            clearInterval(id);
            setTimeout(() => setLive(true), 250);
          }
          return next;
        });
      }, 16);
    };
  }, []);

  return (
    <ShaderLibrary shaders={[TIDE]}>
      <main className="flex h-full w-full items-center justify-center gap-8 px-8">
        <pre className="border-fd-border bg-fd-card w-[372px] shrink-0 overflow-hidden rounded-2xl border p-5 font-mono text-[11px] leading-[1.7] whitespace-pre-wrap text-[#1c1a17] shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]">
          <span className={tone.key}>const</span> tide = <span className={tone.fn}>defineShader</span>({"{\n"}
          {"  "}id: <span className={tone.str}>"acme/tide"</span>,{"\n"}
          {"  "}dialect: <span className={tone.str}>"twigl"</span>,{"\n"}
          {"  "}source: <span className={tone.str}>`</span>
          <span className="break-all">{SOURCE.slice(0, typed)}</span>
          {typed < SOURCE.length ? (
            <span className="inline-block h-[1.1em] w-[0.5em] bg-[#d9482a] align-middle" />
          ) : null}
          <span className={tone.str}>`</span>,{"\n"}
          {"});\n\n<"}
          <span className={tone.fn}>ShaderLibrary</span>
          {" shaders={[tide]}>\n  <"}
          <span className={tone.fn}>PaymentCard</span>
          {"\n    background={{ type: "}
          <span className={tone.str}>"shader"</span>
          {", shader: "}
          <span className={tone.str}>"acme/tide"</span>
          {" }}\n  />\n</"}
          <span className={tone.fn}>ShaderLibrary</span>
          {">"}
        </pre>
        <div className="w-[330px] shrink-0">
          <PaymentCard {...DEMO} background={live ? LIVE : PLAIN} spent={842} limit={1200} />
        </div>
      </main>
    </ShaderLibrary>
  );
}
