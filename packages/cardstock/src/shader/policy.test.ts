import { describe, expect, it } from "vitest";

import { advance, type PlayInputs, playState } from "./policy";

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
  it("runs at speed, frozen or not: the frost is a layer, not a pause", () => {
    expect(advance(1, 0.5, 2)).toBe(2);
    expect(advance(1, 0.5, 0)).toBe(1);
  });
});
