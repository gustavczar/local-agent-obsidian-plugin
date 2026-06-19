import { describe, it, expect } from "vitest";
import { withDefaults, DEFAULT_SETTINGS } from "../src/store/PluginStore";

describe("PluginStore.withDefaults", () => {
  it("fills missing fields with defaults", () => {
    const s = withDefaults({ agentsFolder: "X" } as any);
    expect(s.agentsFolder).toBe("X");
    expect(s.positions).toEqual({});
    expect(s.providers).toEqual(DEFAULT_SETTINGS.providers);
    expect(s.activeProviderId).toBe(DEFAULT_SETTINGS.activeProviderId);
  });

  it("returns full defaults for null", () => {
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });
});
