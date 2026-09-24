import { describe, expect, it } from "vitest";

import { advance, freezeRate, type PlayInputs, playState } from "./policy";

const base: PlayInputs = {
  play: "auto",
  reducedMotion: false,
  slideActive: undefined,
  faceVisible: undefined,
  turning: false,
};

describe("playState", () => {
  it("plays on its own, and in the current slide on the visible face", () => {
    expect(playState(base)).toBe("play");
    expect(playState({ ...base, slideActive: true, faceVisible: true })).toBe("play");
  });

  it("holds off the current slide, or on the face turned away unless it's turning", () => {
    expect(playState({ ...base, slideActive: false })).toBe("hold");
    expect(playState({ ...base, faceVisible: false })).toBe("hold");
    expect(playState({ ...base, faceVisible: false, turning: true })).toBe("play");
  });

  it("obeys play, and reduced motion over everything", () => {
    expect(playState({ ...base, play: "paused" })).toBe("hold");
    expect(playState({ ...base, play: "always", slideActive: false })).toBe("play");
    expect(playState({ ...base, play: "always", reducedMotion: true })).toBe("still");
  });
});

describe("time", () => {
  it("runs at speed, easing to a stop as the card freezes", () => {
    expect(advance(1, 0.5, 2, 0)).toBe(2);
    expect(freezeRate(0.5)).toBeCloseTo(0.5);
    expect(advance(1, 0.5, 2, 1)).toBe(1);
  });
});
