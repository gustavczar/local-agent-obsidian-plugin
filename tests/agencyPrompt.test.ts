import { describe, it, expect } from "vitest";
import { AGENCY_DIRECTIVE, sanitizePath, resolveTargetPath, provenanceFooter, addToMemory } from "../src/agency/agencyPrompt";

describe("AGENCY_DIRECTIVE", () => {
  it("cites the tools and the json contract", () => {
    expect(AGENCY_DIRECTIVE).toContain("create_note");
    expect(AGENCY_DIRECTIVE).toContain("edit_note");
    expect(AGENCY_DIRECTIVE).toContain("append_memory");
    expect(AGENCY_DIRECTIVE).toContain('"actions"');
  });
});

describe("addToMemory", () => {
  it("inserts a bullet under an existing memory section", () => {
    const body = "You are X.\n\n## 🧠 Memória\n- antigo\n\n## Conexões\n- [[Y]]";
    const out = addToMemory(body, "novo aprendizado");
    expect(out).toContain("## 🧠 Memória\n- novo aprendizado\n- antigo");
    expect(out).toContain("## Conexões");
  });

  it("creates the memory section before Conexões when absent", () => {
    const body = "You are X.\n\n## Conexões\n- [[Y]]";
    const out = addToMemory(body, "primeiro");
    expect(out.indexOf("## 🧠 Memória")).toBeGreaterThan(-1);
    expect(out.indexOf("## 🧠 Memória")).toBeLessThan(out.indexOf("## Conexões"));
    expect(out).toContain("- primeiro");
  });

  it("appends the section at the end when there is no Conexões", () => {
    const out = addToMemory("You are X.", "aprendi");
    expect(out).toContain("You are X.");
    expect(out.trimEnd().endsWith("- aprendi")).toBe(true);
  });
});

describe("sanitizePath", () => {
  it("strips traversal and invalid chars", () => {
    expect(sanitizePath("../../etc/pa:ss")).toBe("etc/pa-ss.md");
  });

  it("keeps a clean subfolder path and ensures .md", () => {
    expect(sanitizePath("Pasta/Nota")).toBe("Pasta/Nota.md");
  });

  it("leaves an already-.md path", () => {
    expect(sanitizePath("a/b.md")).toBe("a/b.md");
  });
});

describe("resolveTargetPath", () => {
  it("honors an explicit folder in the agent path", () => {
    expect(resolveTargetPath("X/Nota.md", "Agencia", "Conversas")).toBe("X/Nota.md");
  });

  it("falls back to agencyFolder when path has no folder", () => {
    expect(resolveTargetPath("Nota.md", "Agencia", "Conversas")).toBe("Agencia/Nota.md");
  });

  it("falls back to conversationsFolder when agencyFolder empty", () => {
    expect(resolveTargetPath("Nota.md", "", "Conversas")).toBe("Conversas/Nota.md");
  });

  it("falls back to root when both empty", () => {
    expect(resolveTargetPath("Nota.md", "", "")).toBe("Nota.md");
  });
});

describe("provenanceFooter", () => {
  it("renders the agent wikilink and date", () => {
    const foot = provenanceFooter("escriba", new Date("2026-06-20T19:24:00"));
    expect(foot).toContain("[[escriba]]");
    expect(foot).toContain("2026-06-20 19:24");
    expect(foot.startsWith("\n\n> 🤖")).toBe(true);
  });
});
