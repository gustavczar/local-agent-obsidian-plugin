import { describe, it, expect } from "vitest";
import { buildAgencyReport, ActionResult } from "../src/agency/buildAgencyReport";

describe("buildAgencyReport", () => {
  it("formats links by status", () => {
    const results: ActionResult[] = [
      { status: "created", path: "06. Sistema/Resumo.md" },
      { status: "edited", path: "2026-06-20.md", mode: "append" },
      { status: "remembered", path: "06. Sistema/SUB-AGENTS/escriba.md" },
      { status: "skipped", path: "Foo.md" },
      { status: "failed", path: "Bar.md", err: "sem permissão" },
    ];
    const body = buildAgencyReport("escriba", results);
    expect(body).toContain("> ✅ Criou [[Resumo]]");
    expect(body).toContain("> ✏️ Editou [[2026-06-20]] (append)");
    expect(body).toContain("> 🧠 Anotou na memória de [[escriba]]");
    expect(body).toContain("> ⏭️ Pulou Foo.md");
    expect(body).toContain("> ⚠️ Falhou Bar.md — sem permissão");
    expect(body).toContain("escriba");
  });

  it("returns a neutral line for empty results", () => {
    expect(buildAgencyReport("escriba", [])).toContain("Nenhuma ação");
  });
});
