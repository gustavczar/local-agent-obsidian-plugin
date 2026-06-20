import { describe, it, expect } from "vitest";
import { buildSquadRun } from "../src/squad/buildSquadRun";

describe("buildSquadRun", () => {
  it("renders frontmatter + one section per step result", () => {
    const md = buildSquadRun(
      "Post Instagram",
      [
        { agent: "Designer", instruction: "conceito", output: "imagem X" },
        { agent: "Escriba", instruction: "legenda", output: "legenda Y" },
      ],
      new Date("2026-06-20T10:00:00"),
    );
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("# 🤝 Squad: Post Instagram");
    expect(md).toContain("## 1. Designer");
    expect(md).toContain("imagem X");
    expect(md).toContain("## 2. Escriba");
    expect(md).toContain("legenda Y");
  });
});
