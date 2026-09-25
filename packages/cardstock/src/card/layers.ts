/* What the layers of one face share, without importing each other: the live background a
 * <Shader /> draws, which <Frost /> lays its ice over. No React and no WebGL here, so the frost
 * entry doesn't pull in the shader runtime. */

/** A pass drawn over the face's live background into a canvas of its own. */
export interface FaceOverlay {
  /** A GLSL ES 3.00 fragment shader taking `in vec2 vUv`, `uBackground` (the background's frame,
   * live), `uContent` (the snapshot of the face's content, straight alpha), `uProgress`, `uAspect`. */
  source: string;
  progress: () => number;
  /** After each frame it draws. */
  onDraw?: () => void;
}

export interface FaceOverlayHandle {
  /** The face's content (its text, chip, number) on a transparent canvas, drawn over the frame. */
  setContent(content: TexImageSource | null): void;
  remove(): void;
}

/** The face's live background. `ready` is false until its first frame. */
export interface ShaderLayer {
  ready: boolean;
  attachOverlay(canvas: HTMLCanvasElement, overlay: FaceOverlay): FaceOverlayHandle;
}

export interface FaceLayers {
  get(): ShaderLayer | null;
  set(layer: ShaderLayer | null): void;
  /** Clears the layer, if it's still this one. */
  clear(layer: ShaderLayer): void;
  subscribe(listener: () => void): () => void;
}

export function createFaceLayers(): FaceLayers {
  let current: ShaderLayer | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    get: () => current,
    set(layer) {
      current = layer;
      notify();
    },
    clear(layer) {
      if (current !== layer) return;
      current = null;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
