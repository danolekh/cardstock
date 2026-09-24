/** Masking and the decode reveal, as pure functions of the text and a 0..1 progress. */

export interface MaskOptions {
  /** Character that stands in for a hidden digit. */
  mask?: string;
  /** How many trailing digits stay visible while masked (4 for a card number, 0 for a CVC). */
  visible?: number;
}

export type CharState = "static" | "masked" | "scrambling" | "revealed";

export interface Cell {
  /** The character to show at this point of the reveal. */
  char: string;
  state: CharState;
  /** Position in the text. */
  index: number;
  /** Which space-separated group the character is in. */
  group: number;
}

/** Hides every digit except the last `visible` ones; spaces and other characters stay. */
export function maskText(text: string, { mask = "•", visible = 4 }: MaskOptions = {}): string {
  const digits = [...text].filter((ch) => /\d/.test(ch)).length;
  let seen = 0;
  return [...text]
    .map((ch) => {
      if (!/\d/.test(ch)) return ch;
      seen++;
      return seen > digits - visible ? ch : mask;
    })
    .join("");
}

/** Share of the progress each character spends scrambling; the starts spread over the rest. */
export const SCRAMBLE = 0.3;
const STEPS = 3;
const scrambleDigit = (i: number, step: number) => (Math.imul(i * 131 + step + 7, 2654435761) >>> 0) % 10;

/** The cells at a point of the reveal. Masked characters resolve left to right as `p` rises (right
 * to left as it falls), each passing through a few scrambled digits; the scramble depends only on
 * `p`, so a reversal retraces the same digits. With `scramble: false` a character is either
 * masked or revealed, switching at its own point of the sweep. */
export function decodeAt(
  text: string,
  p: number,
  options: MaskOptions & { scramble?: boolean } = {},
): Cell[] {
  const hidden = maskText(text, options);
  const changing = [...text].flatMap((ch, i) => (ch !== hidden[i] ? [i] : []));
  const order = new Map(changing.map((i, k) => [i, k]));
  let group = 0;
  return [...text].map((ch, index) => {
    if (/\s/.test(ch)) group++;
    const k = order.get(index);
    if (k === undefined) return { char: ch, state: "static", index, group };
    const start = changing.length > 1 ? (k / (changing.length - 1)) * (1 - SCRAMBLE) : 0;
    const local = (p - start) / SCRAMBLE;
    if (local >= 1 || (options.scramble === false && local >= 0.5))
      return { char: ch, state: "revealed", index, group };
    if (local <= 0 || options.scramble === false)
      return { char: hidden[index] ?? ch, state: "masked", index, group };
    return {
      char: String(scrambleDigit(index, Math.floor(local * STEPS))),
      state: "scrambling",
      index,
      group,
    };
  });
}
