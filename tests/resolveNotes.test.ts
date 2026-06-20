import { describe, it, expect } from "vitest";
import { resolveNotes } from "../src/context/resolveNotes";
import { TFile } from "obsidian";
import { Agent } from "../src/types";

const agent: Agent = { name: "nexo", title: "Nexo", systemPrompt: "x", room: "Estrategia", connections: ["MOC MM"], filePath: "nexo.md" };

function app(map: Record<string, string>) {
  return {
    vault: { read: async (f: any) => map[f.path] },
    metadataCache: {
      getFirstLinkpathDest: (lp: string) => (map[lp + ".md"] ? Object.assign(new TFile(lp + ".md"), { path: lp + ".md" }) : null),
    },
  } as any;
}

describe("resolveNotes", () => {
  it("reads connection notes that resolve to files", async () => {
    const out = await resolveNotes(app({ "MOC MM.md": "naval taleb" }), agent, []);
    expect(out).toEqual([{ path: "MOC MM.md", content: "naval taleb" }]);
  });

  it("appends explicit @mentions and dedupes", async () => {
    const out = await resolveNotes(app({ "MOC MM.md": "a", "Nota X.md": "b" }), agent, ["Nota X", "MOC MM"]);
    expect(out.map((n) => n.path).sort()).toEqual(["MOC MM.md", "Nota X.md"]);
  });

  it("includes notes under configured context folders", async () => {
    const map: Record<string, string> = {
      "MOC MM.md": "a",
      "05. Inbox/ideia.md": "uma ideia",
      "05. Inbox/sub/outra.md": "outra",
      "Outra Pasta/nao.md": "fora",
    };
    const a = {
      vault: {
        read: async (f: any) => map[f.path],
        getMarkdownFiles: () => Object.keys(map).map((p) => Object.assign(new TFile(p), { path: p })),
      },
      metadataCache: {
        getFirstLinkpathDest: (lp: string) => (map[lp + ".md"] ? Object.assign(new TFile(lp + ".md"), { path: lp + ".md" }) : null),
      },
    } as any;

    const out = await resolveNotes(a, agent, [], ["05. Inbox"]);
    const paths = out.map((n) => n.path).sort();
    expect(paths).toContain("05. Inbox/ideia.md");
    expect(paths).toContain("05. Inbox/sub/outra.md");
    expect(paths).not.toContain("Outra Pasta/nao.md");
    expect(paths).toContain("MOC MM.md"); // connection still included
  });

  it("auto-consults the vault for relevant notes when no folders and autoConsult is on", async () => {
    const map: Record<string, string> = {
      "MOC MM.md": "conn",
      "Como Ler Livros.md": "Mortimer Adler, leitura analítica.",
      "Receita de Bolo.md": "farinha e ovos",
    };
    const a = {
      vault: {
        read: async (f: any) => map[f.path],
        getMarkdownFiles: () => Object.keys(map).map((p) => Object.assign(new TFile(p), { path: p, basename: p.replace(/\.md$/, "") })),
      },
      metadataCache: {
        getFirstLinkpathDest: (lp: string) => (map[lp + ".md"] ? Object.assign(new TFile(lp + ".md"), { path: lp + ".md" }) : null),
      },
    } as any;

    const out = await resolveNotes(a, agent, [], [], "como escrever um livro sobre leitura", true);
    const paths = out.map((n) => n.path);
    expect(paths).toContain("Como Ler Livros.md");
    expect(paths).not.toContain("Receita de Bolo.md");
  });
});
