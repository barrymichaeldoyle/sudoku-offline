import { formatDuration } from "./time";

describe("formatDuration", () => {
  it("formats sub-hour durations as mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(5)).toBe("00:05");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(599)).toBe("09:59");
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("rolls over into h:mm:ss at and beyond an hour", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    // 864:23 from the bug report → 51863s → 14:24:23
    expect(formatDuration(51863)).toBe("14:24:23");
  });

  it("clamps negatives and floors fractional seconds", () => {
    expect(formatDuration(-10)).toBe("00:00");
    expect(formatDuration(65.9)).toBe("01:05");
  });
});
