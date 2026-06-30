import { withWriteLock } from "./client";

describe("withWriteLock", () => {
  it("runs queued writes strictly one at a time, in order", async () => {
    const events: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    // First op starts, then parks until we release it. The second op must not
    // begin until the first has fully resolved.
    const first = withWriteLock(async () => {
      events.push("first:begin");
      await firstHeld;
      events.push("first:end");
    });
    const second = withWriteLock(async () => {
      events.push("second:begin");
      events.push("second:end");
    });

    // Give microtasks a chance: the second op must still be waiting.
    await Promise.resolve();
    expect(events).toEqual(["first:begin"]);

    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(["first:begin", "first:end", "second:begin", "second:end"]);
  });

  it("keeps the chain alive after a rejecting write (no cross-contamination)", async () => {
    const failing = withWriteLock(async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");

    // A later write still runs and its result is returned untouched.
    await expect(withWriteLock(async () => "ok")).resolves.toBe("ok");
  });

  it("returns the wrapped op's resolved value", async () => {
    await expect(withWriteLock(async () => 42)).resolves.toBe(42);
  });
});
