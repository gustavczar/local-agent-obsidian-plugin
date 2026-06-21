import { describe, it, expect } from "vitest";
import { buildBrainstormNote } from "../src/brainstorm/buildBrainstormNote";

describe("buildBrainstormNote", () => {
  const note = buildBrainstormNote(
    "growth do app",
    [{ agent: "pixel", text: "foco em retenção" }, { agent: "escriba", text: "narrativa forte" }],
    "- Convergência: retenção primeiro\n- Próximo passo: definir métrica",
    ["pixel", "escriba"],
    new Date("2026-06-20T21:00:00"),
  );

  it("has frontmatter and the topic in the title", () => {
    expect(note.startsWith("---\n")).toBe(true);
    expect(note).toContain("# 🧠 Brainstorm: growth do app");
  });

  it("renders each turn as a linked line", () => {
    expect(note).toContain("**[[pixel]]:** foco em retenção");
    expect(note).toContain("**[[escriba]]:** narrativa forte");
  });

  it("includes participants, synthesis and the daily link", () => {
    expect(note).toContain("> Participantes: [[pixel]] · [[escriba]]");
    expect(note).toContain("## Síntese");
    expect(note).toContain("Convergência: retenção primeiro");
    expect(note).toContain("- [[2026-06-20]]");
  });
});
