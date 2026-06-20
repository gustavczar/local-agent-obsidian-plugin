import { describe, it, expect } from "vitest";
import { stripTrailingProvenance, provenanceFooter } from "../src/agency/agencyPrompt";

describe("stripTrailingProvenance", () => {
  it("removes a trailing provenance footer", () => {
    const body = "# Nota\n\nconteúdo" + provenanceFooter("escriba", new Date("2026-06-20T20:39:00"));
    expect(stripTrailingProvenance(body)).toBe("# Nota\n\nconteúdo");
  });

  it("leaves text without a footer unchanged", () => {
    expect(stripTrailingProvenance("# Nota\n\nsem rodapé")).toBe("# Nota\n\nsem rodapé");
  });

  it("only strips the trailing footer, keeping inline content", () => {
    const body = "linha\n> 🤖 [[x]] · 2026-01-01 00:00\nmais texto" + provenanceFooter("escriba", new Date("2026-06-20T20:40:00"));
    expect(stripTrailingProvenance(body)).toBe("linha\n> 🤖 [[x]] · 2026-01-01 00:00\nmais texto");
  });
});
