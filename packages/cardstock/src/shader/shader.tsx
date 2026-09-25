"use client";
import type * as React from "react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import type { ShaderBackground } from "../background/background";
import { useBackgroundValue } from "../card/background";
import { CardContext } from "../card/context";
import { useFaceSide } from "../card/faces";
import { useTiltPointer } from "../card/tilt";
import { SlideContext } from "../carousel/context";
import { usePrefersReducedMotion } from "../utils/media";
import { type PartProps, usePart } from "../utils/part";
import { useIsoLayoutEffect } from "../utils/use-iso-layout-effect";
import type { ShaderDefinition } from "./define";
import { useShaderLibrary } from "./library";
import { resolveParams } from "./params";
import { playState, type ShaderPlay } from "./policy";
import { loadShaderPreset } from "./presets";
import { pageScheduler, type SurfaceHandle, type SurfaceStatus } from "./scheduler";

export interface ShaderState extends Record<string, unknown> {
  /** Its first frame is drawn, and it shows over the poster. */
  ready: boolean;
  /** Its time is running. */
  playing: boolean;
  /** It can't draw here (no WebGL2, the GPU keeps dropping it, an unknown id or a GLSL error):
   * the poster, or the background's colour, stays. */
  failed: boolean;
}

export interface ShaderProps extends PartProps<"canvas", ShaderState> {
  /** `"auto"` (the default) runs its time while the card is in view, its face is showing and its
   * carousel slide is current; `"always"` whenever it's in view; `"paused"` holds the frame it
   * shows. Reduced motion shows the shader's still frame, whatever this says. */
  play?: ShaderPlay;
  /** The shader to draw, instead of looking up the background's id. */
  definition?: ShaderDefinition;
  /** The background to draw, instead of the enclosing `Card.Background`'s. */
  value?: ShaderBackground;
  /** The most device pixels per CSS pixel it draws; 2 by default. */
  maxDpr?: number;
  /** The most pixels it draws per frame, scaled down past it; 1,000,000 by default. */
  maxPixels?: number;
}

const FILL: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  pointerEvents: "none",
};
const CENTER = [0.5, 0.5] as const;
const zero = () => 0;
const center = () => CENTER;

// Read through a typeof check: in a bundle it's replaced, in a browser without one it isn't defined.
declare const process: { env: { NODE_ENV?: string } } | undefined;
const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/** Draws a shader background live, over the poster `Card.Background` shows: put it inside
 * `Card.Background`. It fades in on its first frame, and until then (or where it can't draw at
 * all) the poster or the background's colour shows, so the server render and the first paint are
 * the same card. Every <Shader /> on the page shares one WebGL2 context and one animation frame,
 * so a carousel of them is fine. Renders a `<canvas>`. */
export function Shader(props: ShaderProps): React.ReactElement | null {
  const { play = "auto", definition: given, value, maxDpr = 2, maxPixels = 1_000_000, ...rest } = props;
  const inherited = useBackgroundValue();
  const bg = value ?? (inherited?.type === "shader" ? inherited : undefined);
  const card = useContext(CardContext);
  const slide = useContext(SlideContext);
  const face = useFaceSide();
  const pointer = useTiltPointer();
  const systemReduced = usePrefersReducedMotion();
  const reducedMotion = card ? card.reducedMotion : systemReduced;
  const library = useShaderLibrary();
  const id = bg?.shader;

  // The definition: given, else registered, else a built-in loaded on demand.
  const known = given ?? (id ? library.get(id) : undefined);
  const [loaded, setLoaded] = useState<{ id: string; definition: ShaderDefinition | null } | null>(null);
  useEffect(() => {
    if (known || !id) return;
    const pending = loadShaderPreset(id);
    let live = true;
    if (!pending) {
      if (DEV)
        console.warn(
          `cardstock: no shader "${id}". Register it with <ShaderLibrary>, or pass \`definition\`.`,
        );
      // oxlint-disable-next-line react/set-state-in-effect -- an unknown id is found out here
      setLoaded({ id, definition: null });
      return;
    }
    pending.then(
      (definition) => live && setLoaded({ id, definition }),
      () => live && setLoaded({ id, definition: null }),
    );
    return () => {
      live = false;
    };
  }, [known, id]);
  const settled = loaded && loaded.id === id ? loaded : null;
  const definition = known ?? settled?.definition ?? undefined;
  const missing = !known && settled?.definition === null;

  const [status, setStatus] = useState<SurfaceStatus>({ ready: false, playing: false, failed: false });
  const [turning, setTurning] = useState(false);
  // The Progress objects are stable for the card's life, unlike the context value around them,
  // which changes with every flip and freeze.
  const freeze = card?.freeze;
  const flip = card?.flip;
  useEffect(() => {
    if (!flip) return;
    const read = () => setTurning(flip.get() > 0 && flip.get() < 1);
    read();
    return flip.subscribe(read);
  }, [flip]);

  const state = playState({
    play,
    reducedMotion,
    slideActive: slide ? slide.active : undefined,
    faceVisible: face ? face.visible : undefined,
    turning,
  });
  const uniforms = useMemo(
    () => (definition ? resolveParams(definition, bg?.params) : []),
    [definition, bg?.params],
  );
  const speed = bg?.speed ?? 1;

  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SurfaceHandle | null>(null);
  const latest = useRef({ definition: definition ?? null, uniforms, speed, state, maxDpr, maxPixels });
  useIsoLayoutEffect(() => {
    latest.current = { definition: definition ?? null, uniforms, speed, state, maxDpr, maxPixels };
  });

  // Registered once per canvas; what changes later goes through update() below. Registering again
  // would restart its clock, so this depends only on what lasts as long as the card.
  const [surface, setSurface] = useState<SurfaceHandle | null>(null);
  useIsoLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scheduler = pageScheduler();
    const h = scheduler.add(
      canvas,
      latest.current,
      {
        freeze: freeze ? () => freeze.get() : zero,
        flip: flip ? () => flip.get() : zero,
        pointer: pointer ? () => [pointer.x, pointer.y] as const : center,
      },
      setStatus,
    );
    handle.current = h;
    setSurface(h);
    const unsubscribe = [freeze?.subscribe(h.wake), flip?.subscribe(h.wake), pointer?.subscribe(h.wake)];
    return () => {
      unsubscribe.forEach((u) => u?.());
      h.remove();
      handle.current = null;
      setSurface(null);
    };
  }, [freeze, flip, pointer]);

  useIsoLayoutEffect(() => {
    handle.current?.update(latest.current);
  }, [definition, uniforms, speed, state, maxDpr, maxPixels]);

  const failed = status.failed || missing;
  const shown = status.ready && !failed;

  // Offer the live background to the face's other layers (the frost): pending until the first
  // frame, gone if it can't draw, so the frost knows to wait, to layer, or to go its own way.
  const layers = face?.layers;
  const active = Boolean(bg || given);
  useEffect(() => {
    if (!layers || !surface || !active || failed) return;
    const layer = { ready: shown, attachOverlay: surface.attachOverlay };
    layers.set(layer);
    return () => layers.clear(layer);
  }, [layers, surface, active, failed, shown]);
  const partState: ShaderState = { ready: shown, playing: status.playing && !failed, failed };
  const element = usePart(
    "card-shader",
    "canvas",
    partState,
    rest as PartProps<"canvas", ShaderState>,
    {
      "aria-hidden": true,
      style: { ...FILL, opacity: shown ? 1 : 0, transition: "opacity 300ms ease" },
    },
    [ref as React.Ref<never>],
  );
  return bg || given ? element : null;
}
