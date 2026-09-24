"use client";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

export type PresencePhase = "starting" | "open" | "ending" | "closed";

/** Mounting and unmounting that waits for CSS: like Base UI popups, the element carries
 * `data-starting-style` on its first frame and `data-ending-style` while it leaves, and stays
 * mounted until its transitions or animations finish. */
export function usePresence(open: boolean): {
  phase: PresencePhase;
  ref: React.RefObject<HTMLElement | null>;
  attributes: Record<string, string | undefined>;
} {
  const [phase, setPhase] = useState<PresencePhase>(open ? "open" : "closed");
  const [seen, setSeen] = useState(open);
  const ref = useRef<HTMLElement>(null);

  // A change of `open` starts the next phase in the same render (React's "adjust state on a
  // prop change" pattern), so the first frame already carries the starting or ending style.
  if (seen !== open) {
    setSeen(open);
    setPhase(open ? "starting" : phase === "closed" ? "closed" : "ending");
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

  return {
    phase,
    ref,
    attributes: {
      "data-starting-style": phase === "starting" ? "" : undefined,
      "data-ending-style": phase === "ending" ? "" : undefined,
    },
  };
}
