import { describe, expect, it } from "vitest";

import { decodeAt, maskText } from "./mask";

const PAN = "4821 5903 2716 4822";
const text = (p: number, scramble = true) =>
  decodeAt(PAN, p, { scramble })
    .map((c) => c.char)
    .join("");

describe("maskText", () => {
  it("keeps the last digits and every separator", () => {
    expect(maskText(PAN)).toBe("•••• •••• •••• 4822");
  });
  it("hides a short code completely", () => {
    expect(maskText("731", { visible: 0 })).toBe("•••");
  });
  it("takes a custom mask", () => {
    expect(maskText("09/29", { mask: "*", visible: 0 })).toBe("**/**");
  });
});

describe("decodeAt", () => {
  it("is fully masked at 0 and fully revealed at 1", () => {
    expect(text(0)).toBe("•••• •••• •••• 4822");
    expect(text(1)).toBe(PAN);
  });
  it("resolves left to right", () => {
    const mid = decodeAt(PAN, 0.5);
    const revealed = mid.filter((c) => c.state === "revealed").map((c) => c.index);
    const masked = mid.filter((c) => c.state === "masked").map((c) => c.index);
    expect(Math.max(...revealed)).toBeLessThan(Math.min(...masked));
  });
  it("is a pure function of the progress, so a reversal retraces the same frames", () => {
    expect(text(0.37)).toBe(text(0.37));
  });
  it("never scrambles when asked not to", () => {
    for (const p of [0.1, 0.4, 0.8])
      expect(decodeAt(PAN, p, { scramble: false }).some((c) => c.state === "scrambling")).toBe(false);
  });
  it("numbers the groups", () => {
    expect(decodeAt(PAN, 0).at(-1)?.group).toBe(3);
  });
});
