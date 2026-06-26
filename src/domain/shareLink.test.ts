import {
  buildShareLink,
  describeChallengeOutcome,
  LINK_ORIGIN,
  parseChallengeRoute,
} from "./shareLink";

describe("buildShareLink", () => {
  it("builds a puzzle link with time, mistakes, and difficulty fallback", () => {
    expect(
      buildShareLink({
        kind: "puzzle",
        ref: "easy_0042",
        difficulty: "easy",
        timeSeconds: 272,
        mistakes: 1,
      }),
    ).toBe(`${LINK_ORIGIN}/play/p/easy_0042?t=272&m=1&d=easy`);
  });

  it("uses the date key and d/c segments for daily and challenge links", () => {
    expect(
      buildShareLink({ kind: "daily", ref: "2026-06-19", timeSeconds: 600, mistakes: 0 }),
    ).toBe(`${LINK_ORIGIN}/play/d/2026-06-19?t=600&m=0`);
    expect(buildShareLink({ kind: "challenge", ref: "2026-06-19" })).toBe(
      `${LINK_ORIGIN}/play/c/2026-06-19`,
    );
  });

  it("omits hidden stats and never carries difficulty for dailies", () => {
    expect(buildShareLink({ kind: "puzzle", ref: "hard_0001", difficulty: "hard" })).toBe(
      `${LINK_ORIGIN}/play/p/hard_0001?d=hard`,
    );
    expect(
      buildShareLink({ kind: "daily", ref: "2026-06-19", difficulty: "medium", mistakes: 2 }),
    ).toBe(`${LINK_ORIGIN}/play/d/2026-06-19?m=2`);
  });

  it("floors and clamps stat values", () => {
    expect(buildShareLink({ kind: "puzzle", ref: "x", timeSeconds: 99.9, mistakes: -3 })).toBe(
      `${LINK_ORIGIN}/play/p/x?t=99&m=0`,
    );
  });
});

describe("parseChallengeRoute", () => {
  it("round-trips a built puzzle link", () => {
    const parsed = parseChallengeRoute({ slug: ["p", "easy_0042"], t: "272", m: "1", d: "easy" });
    expect(parsed).toEqual({
      kind: "puzzle",
      ref: "easy_0042",
      difficulty: "easy",
      target: { timeSeconds: 272, mistakes: 1 },
    });
  });

  it("maps d/c segments to daily/challenge and ignores difficulty there", () => {
    expect(parseChallengeRoute({ slug: ["d", "2026-06-19"], t: "600" })).toEqual({
      kind: "daily",
      ref: "2026-06-19",
      difficulty: null,
      target: { timeSeconds: 600, mistakes: null },
    });
    expect(parseChallengeRoute({ slug: ["c", "2026-06-19"] })?.kind).toBe("challenge");
  });

  it("rejects malformed links", () => {
    expect(parseChallengeRoute({ slug: ["z", "ref"] })).toBeNull();
    expect(parseChallengeRoute({ slug: ["p"] })).toBeNull();
    expect(parseChallengeRoute({ slug: [] })).toBeNull();
  });

  it("drops invalid difficulty and non-numeric stats", () => {
    expect(parseChallengeRoute({ slug: ["p", "x"], d: "bogus", t: "abc", m: "-1" })).toEqual({
      kind: "puzzle",
      ref: "x",
      difficulty: null,
      target: { timeSeconds: null, mistakes: null },
    });
  });
});

describe("describeChallengeOutcome", () => {
  it("celebrates beating the time", () => {
    expect(
      describeChallengeOutcome(
        { timeSeconds: 300, mistakes: null },
        { timeSeconds: 282, mistakes: null },
      ),
    ).toBe("🏅 You beat their time by 00:18!");
  });

  it("reports falling short on time", () => {
    expect(
      describeChallengeOutcome(
        { timeSeconds: 272, mistakes: 1 },
        { timeSeconds: 284, mistakes: 0 },
      ),
    ).toBe("⏱ 00:12 short of their 04:32. Run it back!");
  });

  it("calls a dead heat", () => {
    expect(
      describeChallengeOutcome(
        { timeSeconds: 90, mistakes: null },
        { timeSeconds: 90, mistakes: 5 },
      ),
    ).toBe("🤝 Dead heat with their 01:30.");
  });

  it("falls back to mistakes when no times are present", () => {
    expect(
      describeChallengeOutcome(
        { timeSeconds: null, mistakes: 2 },
        { timeSeconds: null, mistakes: 0 },
      ),
    ).toBe("🏅 Fewer mistakes than them. Clean run!");
    expect(
      describeChallengeOutcome(
        { timeSeconds: null, mistakes: 1 },
        { timeSeconds: null, mistakes: 3 },
      ),
    ).toBe("They had 1, you had 3. Run it back!");
  });

  it("returns null when nothing is comparable", () => {
    expect(
      describeChallengeOutcome(
        { timeSeconds: null, mistakes: null },
        { timeSeconds: null, mistakes: null },
      ),
    ).toBeNull();
  });
});
