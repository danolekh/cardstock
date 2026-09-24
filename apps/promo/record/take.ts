/* A take's mouse, as a timeline: moves, presses and releases at set times, sampled once per frame
 * by the recorder. */

export type Point = [number, number];
type Segment = { t0: number; t1: number; at: (t: number) => Point };

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const linear = (t: number) => t;

export class Take {
  t = 0;
  start: Point;
  pos: Point;
  segments: Segment[] = [];
  presses: { t: number; down: boolean }[] = [];

  /** `start` is where the mouse waits (off the frame) until the first move. */
  constructor(start: Point) {
    this.start = start;
    this.pos = start;
  }

  wait(ms: number) {
    this.t += ms;
    return this;
  }
  path(at: (t: number) => Point, ms: number) {
    this.segments.push({ t0: this.t, t1: this.t + ms, at });
    this.t += ms;
    this.pos = at(1);
    return this;
  }
  move(x: number, y: number, ms: number, ease = easeInOut) {
    const [x0, y0] = this.pos;
    return this.path((t) => {
      const e = ease(t);
      return [x0 + (x - x0) * e, y0 + (y - y0) * e];
    }, ms);
  }
  press(down: boolean) {
    this.presses.push({ t: this.t, down });
    return this;
  }
  click(hold = 90) {
    return this.press(true).wait(hold).press(false);
  }
  drag(dx: number, ms: number, ease = easeInOut) {
    return this.press(true)
      .wait(40)
      .move(this.pos[0] + dx, this.pos[1], ms, ease)
      .press(false);
  }
  /** Circles the card: a figure-eight that eases in and out of its loop. */
  loop(cx: number, cy: number, rx: number, ry: number, ms: number) {
    const [x0, y0] = this.pos;
    return this.path((t) => {
      const a = t * Math.PI * 2;
      const w = easeInOut(Math.min(1, t * 5, (1 - t) * 5));
      return [x0 + (cx + rx * Math.sin(a) - x0) * w, y0 + (cy + ry * Math.sin(2 * a) - y0) * w];
    }, ms);
  }

  at(time: number): Point {
    let p = this.start;
    for (const s of this.segments) {
      if (time < s.t0) break;
      p = s.at(Math.min(1, (time - s.t0) / (s.t1 - s.t0)));
    }
    return p;
  }
  down(time: number): boolean {
    let d = false;
    for (const p of this.presses) if (p.t <= time) d = p.down;
    return d;
  }
}
