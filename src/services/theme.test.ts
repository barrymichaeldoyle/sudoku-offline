import { colorSchemeForPreference } from "./theme";

describe("colorSchemeForPreference", () => {
  it("maps system to 'unspecified' (follow the OS)", () => {
    expect(colorSchemeForPreference("system")).toBe("unspecified");
  });

  it("maps explicit preferences through unchanged", () => {
    expect(colorSchemeForPreference("light")).toBe("light");
    expect(colorSchemeForPreference("dark")).toBe("dark");
  });
});
