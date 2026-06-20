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

  it("reads optional icon and accent (color) for avatar personalization", () => {
    const a = parseAgent(
      { name: "nexo", tags: ["#agente/estrategia"], icon: "🧠", color: "#a78bfa" },
      "You are Nexo.",
      "nexo.md",
    );
    expect(a.icon).toBe("🧠");
    expect(a.accent).toBe("#a78bfa");
  });

  it("leaves icon/accent undefined when absent", () => {
    const a = parseAgent({ name: "nexo", tags: ["#agente/estrategia"] }, "x", "n.md");
    expect(a.icon).toBeUndefined();
    expect(a.accent).toBeUndefined();
  });

  it("works for a minimal/unusual agent (no body, sparse frontmatter)", () => {
    const a = parseAgent({ title: "Solo" }, "", "Agents/solo.md");
    expect(a.name).toBe("solo");
    expect(a.title).toBe("Solo");
    expect(a.room).toBe("Geral");
    expect(a.connections).toEqual([]);
    expect(a.systemPrompt).toBe("");
  });

  it("falls back to the file basename (not the full path) when name is missing", () => {
    const a = parseAgent({}, "You are a plain note agent.", "06. Sistema/SUB-AGENTS/Minha Nota.md");
    expect(a.name).toBe("Minha Nota");
    expect(a.title).toBe("Minha Nota");
    expect(a.room).toBe("Geral");
    expect(a.systemPrompt).toBe("You are a plain note agent.");
  });
});
