"use client";
import {
  backgroundInk,
  backgroundTone,
  Card,
  type CardBackground,
  type CardFlipEffect,
  type CardRootProps,
  type CardRootState,
} from "@danolekh/cardstock";
import { Frost, FrostVeil } from "@danolekh/cardstock/frost";
import { Shader } from "@danolekh/cardstock/shader";
import type * as React from "react";

/* A styled card built from the cardstock primitives: tilt with a glare, a flip, a number that
 * decodes in fixed cells, spending along the bottom edge and frost when frozen. Everything that
 * moves reads the primitives' data attributes and CSS variables, so restyle freely. */

/** Four gradient designs to start from. For artwork or a live shader, pass any `CardBackground` as
 * `background`: `npx @danolekh/cardstock-backgrounds add holo silk` downloads presets into your
 * app. */
export const DESIGNS = {
  ink: {
    type: "linear",
    label: "Ink",
    stops: [
      ["#34322d", 0],
      ["#171614", 0.55],
      ["#080807", 1],
    ],
    ink: "#f1dfa6",
  },
  paper: {
    type: "linear",
    label: "Paper",
    stops: [
      ["#fbf8f1", 0],
      ["#efe8d8", 0.6],
      ["#e2d8c3", 1],
    ],
    ink: "#1c1a17",
  },
  sage: {
    type: "linear",
    label: "Sage",
    stops: [
      ["#7f9b84", 0],
      ["#566f5b", 0.55],
      ["#3a4d3f", 1],
    ],
    ink: "#f4f1e8",
    tone: "dark",
  },
  ember: {
    type: "linear",
    label: "Ember",
    stops: [
      ["#ff8a5c", 0],
      ["#e0512b", 0.5],
      ["#a8321a", 1],
    ],
    ink: "#fff6ee",
    tone: "dark",
  },
} as const satisfies Record<string, CardBackground & { label: string }>;
export type CardDesign = keyof typeof DESIGNS;

/** A hex ink at an alpha, as a real colour: the SVG decorations can't use CSS variables or
 * color-mix(), because the frost snapshot draws each SVG as a standalone image. */
function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${a})`;
}

export interface PaymentCardProps extends Omit<CardRootProps, "children" | "background"> {
  /** Rendered inside `Card.Root` after the card: a place for triggers and other parts. */
  children?: React.ReactNode;
  number: string;
  holder: string;
  expiry: string;
  securityCode: string;
  /** What the card is painted with: any `CardBackground`, e.g. one you stored for this card. */
  background?: CardBackground;
  /** One of the gradient `DESIGNS` by name, when there's no `background`. */
  design?: CardDesign;
  /** Wordmark in the top-left corner. */
  brand?: string;
  spent?: number;
  limit?: number;
  /** False for a card that isn't in focus (a carousel neighbour): no tilt, light frost. */
  active?: boolean;
  /** How it turns over: the sheen by default; `"lift"`, `"toward"` or a mix, like
   * `["lift", "sheen"]`; `"none"` to turn it yourself. */
  flip?: CardFlipEffect;
}

const resolve = <T,>(value: T | ((state: CardRootState) => T) | undefined, state: CardRootState) =>
  typeof value === "function" ? (value as (state: CardRootState) => T)(state) : value;

const cells =
  "[&_[data-char-state]]:inline-block [&_[data-char-state]]:w-[1ch] [&_[data-char-state]]:text-center [&_[data-char-state=scrambling]]:opacity-60";
const face =
  "absolute inset-0 overflow-hidden rounded-[4.5%/7%] shadow-[0_calc(24px+var(--card-flip-lift,0)*18px)_calc(50px+var(--card-flip-lift,0)*24px)_-18px_rgb(0_0_0/0.55)] backface-hidden motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:not-data-visible:opacity-0";

export function PaymentCard({
  number,
  holder,
  expiry,
  securityCode,
  background,
  design = "ink",
  brand = "cardstock",
  spent,
  limit,
  active = true,
  flip = "sheen",
  className,
  style,
  children,
  ...root
}: PaymentCardProps): React.ReactElement {
  const bg: CardBackground = background ?? DESIGNS[design];
  const ink = backgroundInk(bg);
  const d = { ink, sub: alpha(ink, 0.64), line: alpha(ink, 0.1) };
  const vars = {
    "--card-ink": d.ink,
    "--card-sub": d.sub,
    "--card-line": d.line,
  } as React.CSSProperties;
  const artwork = bg.type === "image" || bg.type === "shader";
  // Artwork and shaders are busier than a gradient: a soft shadow keeps the text off them.
  const lift = artwork
    ? backgroundTone(bg) === "dark"
      ? "[text-shadow:0_1px_2px_rgb(0_0_0/0.35)]"
      : "[text-shadow:0_1px_1px_rgb(255_255_255/0.4)]"
    : "";
  const version = `${bg.type === "image" ? bg.src : JSON.stringify(bg)}:${spent}:${limit}`;
  return (
    <Card.Root
      {...root}
      background={bg}
      // Your className and style merge with the card's own, as values or functions of its state;
      // your style wins, so you can override the palette variables (--card-bg, --card-ink, …).
      className={(state) => `@container mx-auto w-full max-w-[380px] ${resolve(className, state) ?? ""}`}
      style={(state) => ({ ...vars, ...resolve(style, state) })}
    >
      {/* Tilt is the still hit area and TiltSurface the part that turns: were the element under the
          pointer to turn, its corner would swing away from the pointer and back, over and over. */}
      <Card.Tilt disabled={!active} className="group/tilt relative">
        <div className="relative aspect-[1.586] w-full">
          <Card.TiltSurface className="absolute inset-0">
            {/* The faces ignore the pointer: turned by the tilt, they would sit in front of the flip
              button in 3D and take its clicks. Nothing on them is interactive. */}
            <Card.Body effect={flip} className="pointer-events-none absolute inset-0">
              <Card.Front className={`${face} ${lift}`} style={{ color: "var(--card-ink)" }}>
                {/* A shader background draws live over its poster; off the card in focus it holds
                    its frame. Every card on the page shares one WebGL context. */}
                <Card.Background loading={active ? "eager" : "lazy"} className="absolute inset-0">
                  <Shader play={active ? "auto" : "paused"} />
                </Card.Background>
                {!artwork && <Pattern color={d.line} />}
                <div className="absolute inset-x-[6.5cqw] top-[6cqw] flex items-start justify-between">
                  <span className="text-[5cqw] leading-none font-extrabold tracking-tight">{brand}</span>
                  <span className="text-[3cqw] leading-none font-semibold tracking-[0.18em] text-[var(--card-sub)] uppercase">
                    Debit
                  </span>
                </div>
                <div className="absolute top-[22cqw] left-[6.5cqw] flex items-center gap-[3cqw]">
                  <Chip />
                  <Contactless color={d.sub} />
                </div>
                <Card.Number
                  value={number}
                  className={`absolute inset-x-[6.5cqw] top-[37cqw] font-mono text-[5.6cqw] leading-none [&>span]:inline-flex [&>span]:gap-[0.1em] ${cells}`}
                />
                <div className="absolute inset-x-[6.5cqw] bottom-[7.5cqw] flex items-end justify-between text-[3.2cqw] leading-none font-semibold tracking-[0.12em]">
                  <Card.Holder className="uppercase">{holder}</Card.Holder>
                  <span className="text-right">
                    <span className="mb-[1cqw] block text-[2.3cqw] font-medium tracking-[0.14em] text-[var(--card-sub)]">
                      VALID THRU
                    </span>
                    <Card.Expiry>{expiry}</Card.Expiry>
                  </span>
                </div>
                {spent !== undefined && limit !== undefined && (
                  <Card.Spending
                    aria-label="Spent this month"
                    value={spent}
                    max={limit}
                    className="absolute inset-x-[6.5cqw] bottom-[3.5cqw] h-[1.1cqw] overflow-hidden rounded-full bg-[var(--card-line)]"
                  >
                    <Card.SpendingIndicator className="h-full origin-left scale-x-(--card-spending-ratio) rounded-full bg-[var(--card-ink)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] data-over-limit:bg-red-500" />
                  </Card.Spending>
                )}
                <div
                  data-frost-skip
                  className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-200 group-data-hovering/tilt:opacity-100"
                  style={{
                    background:
                      "radial-gradient(circle at calc(var(--card-pointer-x) * 100%) calc(var(--card-pointer-y) * 100%), rgb(255 255 255 / 0.55), transparent 55%)",
                  }}
                />
                {/* One live WebGL frost, on the card in focus; its neighbours take the veil. */}
                {active ? <Frost version={version} /> : <FrostVeil />}
              </Card.Front>

              <Card.Back className={face} style={{ color: "var(--card-ink)" }}>
                <Card.Background loading="lazy" className="absolute inset-0">
                  <Shader play={active ? "auto" : "paused"} />
                </Card.Background>
                {!artwork && <Pattern color={d.line} />}
                <div className="absolute inset-x-0 top-[11%] h-[18%] bg-[#111]" />
                <div className="absolute inset-x-[6.5%] top-[40%] flex items-center gap-[4%]">
                  <div className="h-[2.1em] flex-1 rounded-[3px] bg-[repeating-linear-gradient(135deg,#f4f4f4_0_6px,#e6e6e6_6px_12px)]" />
                  <Card.SecurityCode
                    value={securityCode}
                    className={`rounded-[3px] bg-white px-[2cqw] py-[1cqw] font-mono text-[3.8cqw] leading-none text-[#161616] [&>span]:inline-flex [&>span]:gap-[0.2em] ${cells}`}
                  />
                </div>
                <p className="absolute inset-x-[6.5cqw] bottom-[6cqw] text-[2.7cqw] leading-snug text-[var(--card-sub)]">
                  Demo card. The number fails the Luhn check.
                  {bg.type === "image" && bg.credit ? ` Artwork: ${bg.credit}.` : ""}
                </p>
                {active ? <Frost version={`${version}:back`} /> : <FrostVeil />}
              </Card.Back>
            </Card.Body>
          </Card.TiltSurface>
          {/* The flip button sits over the card instead of wrapping it, so its name is just its
              label and the card's text stays readable on its own. */}
          <Card.FlipTrigger
            aria-label="Turn the card over"
            tabIndex={active ? undefined : -1}
            // A card out of focus can't be turned; a click on it falls through to its slide.
            className={`${active ? "" : "pointer-events-none"} absolute inset-0 cursor-pointer rounded-[4.5%/7%] outline-none focus-visible:ring-2 focus-visible:ring-(--card-ink) focus-visible:ring-offset-4`}
          />
        </div>
      </Card.Tilt>
      {children}
    </Card.Root>
  );
}

function Chip() {
  return (
    <svg viewBox="0 0 48 36" className="w-[13cqw]" aria-hidden>
      <defs>
        <linearGradient id="cardstock-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a1" />
          <stop offset="0.5" stopColor="#c9a24a" />
          <stop offset="1" stopColor="#f0d98c" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="34" rx="7" fill="url(#cardstock-chip)" stroke="rgba(0,0,0,0.25)" />
      <path
        d="M1 12h13M1 24h13M34 12h13M34 24h13M14 1v34M34 1v34M14 18h20"
        stroke="rgba(0,0,0,0.3)"
        fill="none"
      />
    </svg>
  );
}

// Decorations take real colours, not CSS variables: the frost snapshot draws each SVG as a
// standalone image, where a variable has nothing to resolve against.
function Contactless({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[6.5cqw]"
      aria-hidden
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M8.5 7.5a6 6 0 0 1 0 9" />
      <path d="M12 5a9.5 9.5 0 0 1 0 14" />
      <path d="M15.5 2.5a13 13 0 0 1 0 19" />
    </svg>
  );
}

// Fine diagonal ruling, like the grain of a sheet of cardstock.
function Pattern({ color }: { color: string }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 320 202"
      preserveAspectRatio="none"
      aria-hidden
    >
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M${-120 + i * 34} 202 L${40 + i * 34} 0`} stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}
