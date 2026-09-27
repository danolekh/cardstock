/** sRGB channels 0..255 of a hex or rgb() colour; null for anything else. */
export function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c)?.[1];
  if (hex && (hex.length === 3 || hex.length === 4)) {
    return [0, 1, 2].map((i) => parseInt(hex[i]! + hex[i]!, 16)) as [number, number, number];
  }
  if (hex && (hex.length === 6 || hex.length === 8)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  const fn = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/i.exec(c);
  if (!fn) return null;
  return [fn[1]!, fn[2]!, fn[3]!].map((ch) =>
    ch.endsWith("%") ? (parseFloat(ch) / 100) * 255 : parseFloat(ch),
  ) as [number, number, number];
}
