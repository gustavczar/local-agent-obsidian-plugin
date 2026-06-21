import { describe, it, expect } from "vitest";
import { buildBrainstormTurnPrompt, buildFacilitatorPrompt, FACILITATOR_SYSTEM } from "../src/brainstorm/buildBrainstormPrompt";

describe("buildBrainstormTurnPrompt", () => {
  it("asks the first speaker to open the discussion", () => {
    const p = buildBrainstormTurnPrompt("growth do app", [], "Pixel");
    expect(p).toContain("growth do app");
    expect(p).toContain("abre a discussão");
    expect(p).toContain("Pixel");
  });

  it("includes prior turns and a no-repeat instruction", () => {
    const p = buildBrainstormTurnPrompt("growth", [{ agent: "Pixel", text: "foco em retenção" }], "Escriba");
    expect(p).toContain("Pixel: foco em retenção");
    expect(p).toContain("Não repita");
    expect(p).toContain("Escriba");
  });
});

describe("buildFacilitatorPrompt", () => {
  it("asks for a synthesis with decisions", () => {
    const p = buildFacilitatorPrompt("growth", [{ agent: "Pixel", text: "x" }]);
    expect(p).toContain("Pixel: x");
    expect(p).toContain("próximos passos");
    expect(FACILITATOR_SYSTEM).toContain("facilitador");
  });
});
