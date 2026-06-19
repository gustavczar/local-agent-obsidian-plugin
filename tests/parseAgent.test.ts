import { describe, it, expect } from "vitest";
import { parseAgent } from "../src/registry/parseAgent";

const body = `You are Nexo — the decision lens. You ask better questions.

## Conexões
- MOC: [[📚 MOC - Agentes & Personas]]
- Sub-agentes: [[venture-builder]]
`;

describe("parseAgent", () => {
  it("derives room from #agente/<categoria> tag", () => {
    const a = parseAgent(
      { name: "nexo", title: "Nexo — Lente da Decisão", tags: ["#agente/estrategia", "#sistema/sub-agente"] },
      body,
      "06. Sistema/SUB-AGENTS/nexo.md",
    );
    expect(a.name).toBe("nexo");
    expect(a.title).toBe("Nexo — Lente da Decisão");
    expect(a.room).toBe("Estrategia");
  });

  it("strips the Conexões section from the system prompt", () => {
    const a = parseAgent({ name: "nexo", tags: ["#agente/estrategia"] }, body, "x.md");
    expect(a.systemPrompt).toContain("You are Nexo");
    expect(a.systemPrompt).not.toContain("## Conexões");
  });

  it("collects wikilinks as connections", () => {
    const a = parseAgent({ name: "nexo", tags: ["#agente/estrategia"] }, body, "x.md");
    expect(a.connections).toContain("📚 MOC - Agentes & Personas");
    expect(a.connections).toContain("venture-builder");
  });

  it("falls back to Geral room and title=name when missing", () => {
    const a = parseAgent({ name: "ghost" }, "You are a ghost.", "g.md");
    expect(a.room).toBe("Geral");
    expect(a.title).toBe("ghost");
  });
});
