"use client";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useCard } from "./context";

export interface CardFrozenOverlayState extends Record<string, unknown> {
  open: boolean;
}
export interface CardFrozenOverlayProps extends PartProps<"div", CardFrozenOverlayState> {
  /** Keep it in the DOM while the card isn't frozen (then style `[data-open]` yourself). */
  keepMounted?: boolean;
}

type Phase = "starting" | "open" | "ending" | "closed";

/** Shown while the card is frozen: a place for your own frost, lock or tint. Like Base UI popups
 * it carries `data-starting-style` on its first frame and `data-ending-style` while it leaves,
 * and waits for your CSS transitions or animations to finish before it unmounts. Renders a
 * `<div>`. */
export function CardFrozenOverlay(props: CardFrozenOverlayProps): React.ReactElement | null {
  const { keepMounted = false, ...rest } = props;
  const { frozen } = useCard();
  const [phase, setPhase] = useState<Phase>(frozen ? "open" : "closed");
  const [seen, setSeen] = useState(frozen);
  const ref = useRef<HTMLElement>(null);

  // A change of `frozen` starts the next phase in the same render (React's "adjust state on a
  // prop change" pattern), so the first frame already carries the starting or ending style.
  if (seen !== frozen) {
    setSeen(frozen);
    setPhase(frozen ? "starting" : phase === "closed" ? "closed" : "ending");
  }

  useEffect(() => {
    if (phase === "starting") {
      // Two frames: let the browser paint the starting style, then transition from it.
      let inner = 0;
      const outer = requestAnimationFrame(() => (inner = requestAnimationFrame(() => setPhase("open"))));
      return () => (cancelAnimationFrame(outer), cancelAnimationFrame(inner));
    }
    if (phase === "ending") {
      let cancelled = false;
      const frame = requestAnimationFrame(() => {
        const animations = ref.current?.getAnimations?.() ?? [];
        void Promise.allSettled(animations.map((a) => a.finished)).then(
          () => !cancelled && setPhase("closed"),
        );
      });
      return () => ((cancelled = true), cancelAnimationFrame(frame));
    }
    return undefined;
  }, [phase]);

  const element = usePart(
    "card-frozen-overlay",
    "div",
    { open: frozen },
    rest,
    {
      "aria-hidden": true,
      "data-starting-style": phase === "starting" ? "" : undefined,
      "data-ending-style": phase === "ending" ? "" : undefined,
    },
    [ref as React.Ref<never>],
  );
  return phase !== "closed" || keepMounted ? element : null;
}
