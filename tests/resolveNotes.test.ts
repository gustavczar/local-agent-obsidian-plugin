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
});
