import { describe, it, expect } from "vitest";
import { rankNotes } from "../src/context/searchVault";

describe("rankNotes", () => {
  it("ranks notes by query-term overlap and ignores irrelevant ones", () => {
    const items = [
      { path: "Como Ler Livros.md", text: "Como Ler Livros Como Ler Livros.md" },
      { path: "Receita de Bolo.md", text: "Receita de Bolo Receita de Bolo.md" },
      { path: "Leitura Ativa.md", text: "Leitura Ativa Leitura Ativa.md" },
    ];
    const paths = rankNotes("escrever um livro sobre leitura", items, 5).map((h) => h.path);
    expect(paths).toContain("Como Ler Livros.md");
    expect(paths).toContain("Leitura Ativa.md");
    expect(paths).not.toContain("Receita de Bolo.md");
  });

  it("returns empty when the query has only stopwords/short tokens", () => {
    expect(rankNotes("o que de a", [{ path: "x.md", text: "x" }], 5)).toEqual([]);
  });
});
