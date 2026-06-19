import { describe, it, expect } from "vitest";
import { buildConversationNote } from "../src/chat/crystallize";
import { Agent } from "../src/types";

const agent: Agent = { name: "nexo", title: "Nexo — Lente", systemPrompt: "x", room: "E", connections: [], filePath: "06. Sistema/SUB-AGENTS/nexo.md" };

describe("buildConversationNote", () => {
  it("produces frontmatter + agent link + transcript", () => {
    const md = buildConversationNote(
      agent,
      [{ role: "user", content: "decidir?" }, { role: "assistant", content: "qual o trade-off?" }],
      new Date("2026-06-19T10:00:00"),
    );
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("tipo: '📄 log'");
    expect(md).toContain("[[nexo]]");
    expect(md).toContain("[[2026-06-19]]");
    expect(md).toContain("**Você:** decidir?");
    expect(md).toContain("**Nexo — Lente:** qual o trade-off?");
  });
});
