"use client";
import type * as React from "react";
import { useEffect, useState } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";
import { type Cell, decodeAt, type MaskOptions } from "./mask";

export interface CardDigitsState extends Record<string, unknown> {
  revealed: boolean;
  /** The reveal is under way (in either direction). */
  animating: boolean;
}

export interface CardDigitsProps extends Omit<PartProps<"span", CardDigitsState>, "children"> {
  /** The full value, e.g. "4821 5903 2716 4822". */
  value: string;
  mask?: MaskOptions["mask"];
  visible?: MaskOptions["visible"];
  /** `"scramble"` cycles each digit through random ones as it resolves; `"none"` only switches
   * `data-char-state`, so you animate the cells yourself (their `--char-index` gives a stagger). */
  reveal?: "scramble" | "none";
  /** Render the cells yourself. By default each is a `<span>` with `data-char-state`,
   * `--char-index` and `--group-index`. */
  children?: (cells: Cell[]) => React.ReactNode;
}

function useCells(value: string, options: MaskOptions & { scramble: boolean }) {
  const { reveal, reducedMotion } = useCard();
  const scramble = options.scramble && !reducedMotion;
  const read = () => decodeAt(value, reveal.get(), { ...options, scramble });
  const [cells, setCells] = useState(read);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    const update = (p: number) => {
      setCells(decodeAt(value, p, { mask: options.mask, visible: options.visible, scramble }));
      setAnimating(p > 0 && p < 1);
    };
    update(reveal.get());
    return reveal.subscribe(update);
  }, [reveal, value, options.mask, options.visible, scramble]);
  return { cells, animating };
}

function Digits(slot: string, label: (value: string, revealed: boolean) => string, defaults: MaskOptions) {
  return function Part(props: CardDigitsProps): React.ReactElement {
    const {
      value,
      mask = defaults.mask,
      visible = defaults.visible,
      reveal = "scramble",
      children,
      ...rest
    } = props;
    const { revealed } = useCard();
    const { cells, animating } = useCells(value, { mask, visible, scramble: reveal === "scramble" });
    const content = children
      ? children(cells)
      : cells.map((cell) => (
          <span
            key={cell.index}
            data-slot={`${slot}-char`}
            data-char-state={cell.state}
            style={{ "--char-index": cell.index, "--group-index": cell.group } as React.CSSProperties}
          >
            {cell.char}
          </span>
        ));
    // A plain span can't carry a name, so what a screen reader hears is visually hidden text,
    // and the cells (with their scramble) are hidden from it.
    return usePart(slot, "span", { revealed, animating }, rest, {
      style: { "--char-count": cells.length } as React.CSSProperties,
      children: (
        <>
          <span data-frost-skip="" style={VISUALLY_HIDDEN}>
            {label(value, revealed)}
          </span>
          <span aria-hidden>{content}</span>
        </>
      ),
    });
  };
}

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const last = (value: string, n: number) => value.replace(/\D/g, "").slice(-n);

/** The card number, masked but for its last digits until revealed. Renders a `<span>`; each
 * character is its own cell, so a fixed cell width keeps the line still while digits change. */
export const CardNumber: (props: CardDigitsProps) => React.ReactElement = Digits(
  "card-number",
  (value, revealed) => (revealed ? `Card number ${value}` : `Card number ending in ${last(value, 4)}`),
  { visible: 4 },
);

/** The security code, fully masked until revealed. Renders a `<span>`. */
export const CardSecurityCode: (props: CardDigitsProps) => React.ReactElement = Digits(
  "card-security-code",
  (value, revealed) => (revealed ? `Security code ${value}` : "Security code hidden"),
  { visible: 0 },
);
