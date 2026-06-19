import { describe, it, expect } from "vitest";
import { buildPrompt } from "../src/context/ContextBuilder";
import { Agent } from "../src/types";

const agent: Agent = {
  name: "nexo", title: "Nexo", systemPrompt: "You are Nexo.",
  room: "Estrategia", connections: ["MOC Modelos Mentais"], filePath: "nexo.md",
};

describe("buildPrompt", () => {
  it("embeds context notes under a knowledge section in system", () => {
    const out = buildPrompt(agent, [{ role: "user", content: "decidir?" }], [
      { path: "MOC Modelos Mentais.md", content: "Naval, Taleb, Kahneman." },
    ]);
    expect(out.system).toContain("You are Nexo.");
    expect(out.system).toContain("Naval, Taleb, Kahneman.");
    expect(out.system).toContain("MOC Modelos Mentais");
    expect(out.messages).toEqual([{ role: "user", content: "decidir?" }]);
  });

  it("omits the knowledge section when there are no notes", () => {
    const out = buildPrompt(agent, [{ role: "user", content: "oi" }], []);
    expect(out.system).toBe("You are Nexo.");
  });
});
