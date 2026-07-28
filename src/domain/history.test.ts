import { formatHistoryDate } from "./history";

describe("formatHistoryDate", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back safely for an invalid completion date", () => {
    expect(formatHistoryDate("not-a-date")).toBe("Unknown date");
  });

  it("omits the year for a result from the current year", () => {
    const format = jest.spyOn(Date.prototype, "toLocaleDateString").mockReturnValue("Jul 28");

    formatHistoryDate("2026-07-28T12:00:00.000Z", new Date("2026-08-01T12:00:00.000Z"));

    expect(format).toHaveBeenCalledWith(undefined, {
      month: "short",
      day: "numeric",
      year: undefined,
    });
  });

  it("includes the year for an older result", () => {
    const format = jest.spyOn(Date.prototype, "toLocaleDateString").mockReturnValue("Dec 31, 2025");

    formatHistoryDate("2025-12-31T12:00:00.000Z", new Date("2026-08-01T12:00:00.000Z"));

    expect(format).toHaveBeenCalledWith(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });
});
