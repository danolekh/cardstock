"use client";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { frostBase } from "../background/background";
import { useCard } from "../card/context";
import { createFrost, snapshotFace, type Stop } from "./shader";
import { FILL, FROST_VEIL, useFreezeOpacity } from "./veil";

export interface FrostProps {
  /** The face's background as gradient stops (drawn at 135deg). By default the card's
   * `background`, or else the face's background colour. */
  stops?: readonly Stop[];
  /** Change it whenever the face looks different (a new number, colour or limit) to retake the
   * snapshot the frost refracts. */
  version?: string | number;
  className?: string;
}

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
/** A lost context is rebuilt once; a second loss this soon after means the GPU won't keep one. */
const LOSS_WINDOW_MS = 10_000;

/** Frosts the face it sits in as the card freezes, with a WebGL2 shader that refracts a snapshot
 * of the face. Put it inside `Card.Front` or `Card.Back`, after the content it should cover; the
 * face needs `position: relative` and `overflow: hidden`. Each one holds a GPU context while it's
 * mounted, so cards out of focus should use `<FrostVeil />`. Where WebGL2 isn't there, or keeps
 * losing its context, it shows the veil itself. Renders a `<div>` over the face with a canvas. */
export function Frost(props: FrostProps): React.ReactElement {
  const { stops = [], version = "", className } = props;
  const { freeze, background } = useCard();
  const base = stops.length
    ? ({ kind: "linear", angle: 135, stops } as const)
    : background
      ? frostBase(background)
      : undefined;
  // Compared by value: a new background (or new stops) retakes the snapshot.
  const baseKey = JSON.stringify(base ?? null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Bumped when the browser takes the WebGL context away, to start over on a fresh canvas.
  const [session, setSession] = useState(0);
  const lastLoss = useRef(-Infinity);
  const baseRef = useRef(base);
  useLayoutEffect(() => {
    baseRef.current = base;
  });
  const resnap = useRef<() => void>(() => {});
  // Compiling the shader and snapshotting the face cost a few frames, so it waits for an idle
  // moment after load, or for the first freeze, whichever comes first.
  const [armed, setArmed] = useState(() => freeze.get() > 0);
  useEffect(() => {
    if (armed) return;
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => setArmed(true), { timeout: 3000 })
      : window.setTimeout(() => setArmed(true), 1500);
    const unsubscribe = freeze.subscribe((p) => p > 0 && setArmed(true));
    return () => {
      unsubscribe();
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [armed, freeze]);
  const useShader = !failed && armed;

  useEffect(() => {
    const host = hostRef.current;
    if (!useShader || !host) return;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.prepend(canvas);
    const renderer = createFrost(canvas);
    if (!renderer) {
      canvas.remove();
      // No WebGL2 here: an external fact the effect discovers, so the effect reports it.
      // oxlint-disable-next-line react/set-state-in-effect
      setFailed(true);
      return;
    }
    let raf = 0;
    const redraw = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), renderer.draw(freeze.get(), dpr())));
    };
    let token = 0;
    let live = true;
    resnap.current = () => {
      const face = host.parentElement;
      if (!face) return;
      const mine = ++token;
      document.fonts.ready
        .then(() => snapshotFace(face, baseRef.current, dpr()))
        .then((snap) => {
          if (!snap || mine !== token || !live) return;
          renderer.setFace(snap);
          redraw();
          setReady(true);
        })
        .catch(() => setFailed(true));
    };
    // The browser can drop the context later (GPU reset, too many contexts): show the gradient at
    // once, then rebuild, or settle for the gradient if it keeps happening.
    const onLost = () => {
      live = false;
      setReady(false);
      const now = performance.now();
      if (now - lastLoss.current < LOSS_WINDOW_MS) setFailed(true);
      else setSession((n) => n + 1);
      lastLoss.current = now;
    };
    canvas.addEventListener("webglcontextlost", onLost);
    const ro = new ResizeObserver(() => resnap.current());
    ro.observe(canvas);
    const unsubscribe = freeze.subscribe(redraw);
    return () => {
      live = false;
      // dispose() loses the context on purpose; that isn't a loss to recover from.
      canvas.removeEventListener("webglcontextlost", onLost);
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsubscribe();
      resnap.current = () => {};
      renderer.dispose();
      canvas.remove();
      setReady(false);
    };
    // `session` is a trigger: after a lost context, the same setup on a fresh canvas.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [useShader, freeze, session]);

  // Retake the snapshot when the face changes, after a beat (a stream of changes, like scrubbing
  // a limit, shouldn't clone the face every step) and again once its transitions have settled.
  useEffect(() => {
    const a = setTimeout(() => resnap.current(), 120);
    const b = setTimeout(() => resnap.current(), 800);
    return () => (clearTimeout(a), clearTimeout(b));
    // `version`, `baseKey`, `useShader` and `session` are the triggers: a changed face or
    // background, or a new WebGL session.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [version, baseKey, useShader, session]);

  // A live shader behind the face keeps moving after the snapshot, so retake it as the freeze
  // starts, and again once it's done: the shader's time has eased to a stop by then, so that frame
  // is the one it holds.
  useEffect(() => {
    let previous = freeze.get();
    return freeze.subscribe((p) => {
      const edge = (previous === 0 && p > 0) || (previous < 1 && p === 1);
      previous = p;
      if (edge && hostRef.current?.parentElement?.querySelector('[data-slot="card-shader"]'))
        resnap.current();
    });
  }, [freeze]);

  // The veil follows the freeze directly, and fades out once the shader has taken over.
  const showVeil = !useShader || !ready;
  const veilRef = useFreezeOpacity(showVeil);

  return (
    <div
      ref={hostRef}
      data-slot="card-frost"
      data-frost-skip=""
      aria-hidden
      className={className}
      style={FILL}
    >
      <div
        ref={veilRef}
        style={{
          ...FILL,
          background: FROST_VEIL,
          backdropFilter: "blur(2px)",
          opacity: 0,
          transition: showVeil ? undefined : "opacity 200ms ease",
        }}
      />
    </div>
  );
}
