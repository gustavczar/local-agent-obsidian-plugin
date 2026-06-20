import { describe, it, expect } from "vitest";
import { extractAgentNote, parseNameFromNote } from "../src/office/architectPrompt";

const NOTE = `---
name: designer-minimal
title: Vega — Minimal Designer
tags:
  - "#agente/design"
  - "#sistema/sub-agente"
---
You are Vega. ...`;

describe("architectPrompt helpers", () => {
  it("extracts the note even when wrapped in a code fence + prose", () => {
    const reply = "Claro! Aqui está:\n```markdown\n" + NOTE + "\n```\npronto.";
    const out = extractAgentNote(reply);
    expect(out?.startsWith("---")).toBe(true);
    expect(out).toContain("title: Vega — Minimal Designer");
  });

  it("returns null when there is no frontmatter", () => {
    expect(extractAgentNote("desculpe, não consigo")).toBeNull();
  });

  it("parses the name from frontmatter", () => {
    expect(parseNameFromNote(NOTE)).toBe("designer-minimal");
  });
});
