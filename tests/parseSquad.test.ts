import { describe, it, expect } from "vitest";
import { parseSquad, isSquadFrontmatter } from "../src/squad/parseSquad";

const NOTE = `---
squad: true
---
# Squad: Post pro Instagram

Algum texto de contexto.

1. [[designer-imagens-minimalistas]]: Crie o conceito visual minimalista sobre {tema}.
2. [[escriba]]: Escreva a legenda a partir da imagem.
3. [[pixel]]: Otimize a legenda para engajamento.
`;

describe("parseSquad", () => {
  it("extracts ordered steps with agent ref + instruction", () => {
    const s = parseSquad(NOTE);
    expect(s.name).toBe("Post pro Instagram");
    expect(s.steps).toHaveLength(3);
    expect(s.steps[0]).toEqual({ agentRef: "designer-imagens-minimalistas", instruction: "Crie o conceito visual minimalista sobre {tema}." });
    expect(s.steps[2].agentRef).toBe("pixel");
  });

  it("ignores non-step lines", () => {
    expect(parseSquad("# X\n\nblá blá\n- item\n").steps).toEqual([]);
  });
});

describe("isSquadFrontmatter", () => {
  it("detects squad via flag, tipo, or tag", () => {
    expect(isSquadFrontmatter({ squad: true })).toBe(true);
    expect(isSquadFrontmatter({ tipo: "🤝 squad" })).toBe(true);
    expect(isSquadFrontmatter({ tags: ["#squad"] })).toBe(true);
    expect(isSquadFrontmatter({ tags: ["#agente/x"] })).toBe(false);
    expect(isSquadFrontmatter(undefined)).toBe(false);
  });
});
