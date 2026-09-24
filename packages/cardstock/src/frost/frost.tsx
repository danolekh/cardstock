"use client";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useCard } from "../card/context";
import { createFrost, snapshotFace, type Stop } from "./shader";

export interface FrostProps {
  /** Use the WebGL2 shader. `false` draws the light gradient, which holds no WebGL context. */
  webgl?: boolean;
  /** The face's background as gradient stops (drawn at 135deg); by default its background colour. */
  stops?: readonly Stop[];
  /** Change it whenever the face looks different (a new number, colour or limit) to retake the
   * snapshot the frost refracts. */
  version?: string | number;
  /** The fallback gradient. */
  fallback?: string;
  className?: string;
}

const FALLBACK =
  "linear-gradient(120deg, rgba(222,238,255,0.72), rgba(236,245,255,0.55) 45%, rgba(248,251,255,0.75))";
const FILL: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

/** Frosts the face it sits in as the card freezes. Put it inside `Card.Front` or `Card.Back`,
 * after the content it should cover; the face needs `position: relative` and `overflow: hidden`.
 * Renders a `<div>` over the face with a canvas and the fallback in it. */
export function Frost(props: FrostProps): React.ReactElement {
  const { webgl = true, stops = [], version = "", fallback = FALLBACK, className } = props;
  const { freeze } = useCard();
  const hostRef = useRef<HTMLDivElement>(null);
  const gradientRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const stopsRef = useRef(stops);
  useLayoutEffect(() => {
    stopsRef.current = stops;
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
  const useShader = webgl && !failed && armed;

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
        .then(() => snapshotFace(face, stopsRef.current, dpr()))
        .then((snap) => {
          if (!snap || mine !== token || !live) return;
          renderer.setFace(snap);
          redraw();
          setReady(true);
        })
        .catch(() => setFailed(true));
    };
    const ro = new ResizeObserver(() => resnap.current());
    ro.observe(canvas);
    const unsubscribe = freeze.subscribe(redraw);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsubscribe();
      resnap.current = () => {};
      renderer.dispose();
      canvas.remove();
      setReady(false);
    };
  }, [useShader, freeze]);

  // Retake the snapshot when the face changes, after a beat (a stream of changes, like scrubbing
  // a limit, shouldn't clone the face every step) and again once its transitions have settled.
  useEffect(() => {
    const a = setTimeout(() => resnap.current(), 120);
    const b = setTimeout(() => resnap.current(), 800);
    return () => (clearTimeout(a), clearTimeout(b));
    // `version` and `useShader` are the triggers: a changed face, or a new WebGL session.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [version, useShader]);

  // The gradient follows the freeze directly, and fades out once the shader has taken over.
  const showGradient = !useShader || !ready;
  useEffect(() => {
    const el = gradientRef.current;
    if (!el) return;
    const apply = (p: number) => (el.style.opacity = String(showGradient ? p : 0));
    apply(freeze.get());
    return freeze.subscribe(apply);
  }, [freeze, showGradient]);

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
        ref={gradientRef}
        style={{
          ...FILL,
          background: fallback,
          backdropFilter: "blur(2px)",
          opacity: 0,
          transition: showGradient ? undefined : "opacity 200ms ease",
        }}
      />
    </div>
  );
}
