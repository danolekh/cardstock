/* "Did you mean" for mistyped names: the closest candidate by edit distance, when it's close
 * enough to be a plausible typo rather than a different word. */

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** The candidate nearest to `input`, or undefined when none is within a third of its length
 * (at least 2 edits), or when `input` is a prefix of exactly one. */
export function closest(input: string, candidates: Iterable<string>): string | undefined {
  const list = [...candidates];
  const prefixed = list.filter((c) => c.startsWith(input));
  if (input.length >= 2 && prefixed.length === 1) return prefixed[0];
  let best: string | undefined;
  let bestDistance = Math.max(2, Math.floor(input.length / 3)) + 1;
  for (const candidate of list) {
    const d = distance(input.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) [best, bestDistance] = [candidate, d];
  }
  return best;
}
