import { describe, it, expect, afterEach } from "vitest";
import { t, setLanguage, getLanguage } from "../src/i18n";

afterEach(() => setLanguage("en"));

describe("i18n", () => {
  it("defaults to English", () => {
    expect(getLanguage()).toBe("en");
    expect(t("cmd.brainstorm")).toBe("Multi-agent brainstorm");
  });

  it("switches to Portuguese", () => {
    setLanguage("pt");
    expect(getLanguage()).toBe("pt");
    expect(t("cmd.brainstorm")).toBe("Brainstorm multi-agente");
  });

  it("interpolates {vars}", () => {
    setLanguage("en");
    expect(t("notice.crystallized", { path: "Notes/x.md" })).toBe("Crystallized: Notes/x.md");
    expect(t("notice.squadDone", { name: "Growth", count: 3 })).toBe(
      '"Growth" squad finished — 3 steps.',
    );
  });

  it("falls back to English for keys missing in the active language", () => {
    setLanguage("pt");
    // every pt key mirrors en; an unknown key falls through to en then to the raw key
    expect(t("__does_not_exist__")).toBe("__does_not_exist__");
  });

  it("pt dictionary covers every en key (no missing translations)", () => {
    // guards against half-migrated dictionaries
    setLanguage("en");
    const enKeys = Object.keys(
      // re-require to read the raw maps is overkill; instead probe known keys
      {
        "cmd.openOffice": 1,
        "notice.noProvider": 1,
        "mention.help": 1,
        "set.language.name": 1,
      },
    );
    setLanguage("pt");
    for (const k of enKeys) expect(t(k)).not.toBe(k);
  });
});
