/* Canvases whose pixels live elsewhere. A <Shader /> canvas is filled from a shared WebGL context,
 * and a clone of it (the frost snapshot clones the face) is blank, so a snapshot asks here for the
 * frame the original shows. A WeakMap, so neither side keeps the other alive. */

type Grab = () => CanvasImageSource | null;

const live = new WeakMap<HTMLCanvasElement, Grab>();

/** Registers how to get `canvas`'s current frame; returns the unregister. */
export function registerLiveCanvas(canvas: HTMLCanvasElement, grab: Grab): () => void {
  live.set(canvas, grab);
  return () => {
    if (live.get(canvas) === grab) live.delete(canvas);
  };
}

/** The frame a canvas shows: from its registered source, else the canvas itself. Draw it at once;
 * the source may be reused for the next frame. */
export function grabLiveCanvas(canvas: HTMLCanvasElement): CanvasImageSource | null {
  const grab = live.get(canvas);
  if (!grab) return canvas;
  try {
    return grab();
  } catch {
    return null;
  }
}
