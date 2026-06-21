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

  it("defaults agencyFolder to empty string", () => {
    expect(withDefaults(null).agencyFolder).toBe("");
    expect(withDefaults({ agencyFolder: "X" } as any).agencyFolder).toBe("X");
  });

  it("defaults the token-economy fields", () => {
    const d = withDefaults(null);
    expect(d.economyMode).toBe(false);
    expect(d.maxTokens).toBe(0);
    expect(d.lightProviderId).toBe("");
    const s = withDefaults({ economyMode: true, maxTokens: 1024, lightProviderId: "groq" } as any);
    expect(s.economyMode).toBe(true);
    expect(s.maxTokens).toBe(1024);
    expect(s.lightProviderId).toBe("groq");
  });
});
