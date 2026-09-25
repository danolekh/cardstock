import type { CardBackground, CardFlipEffect } from "@danolekh/cardstock";
import { useEffect } from "react";

/* What every scene shares: the hooks the recorder drives the page through (`window.__stage`),
 * and the signal that the page is ready to film. */

export interface StageApi {
  setFlip?: (effect: CardFlipEffect) => void;
  start?: () => void;
  /** A caption under the stage; null hides it. */
  caption?: (text: string | null) => void;
  /** The bring-your-own-shader beat. */
  byo?: () => void;
  /** The closing card. */
  end?: () => void;
}
export const api: StageApi = ((window as unknown as { __stage?: StageApi }).__stage ??= {});

/** Ready once fonts and artwork are in, and the shader in view has drawn a frame. */
export function useReady(backgrounds: readonly CardBackground[]) {
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
