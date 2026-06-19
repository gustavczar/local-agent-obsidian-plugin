import { describe, it, expect, vi } from "vitest";
import { AgentRegistry } from "../src/registry/AgentRegistry";
import { TFile } from "obsidian";

function fakeApp(files: { path: string; fm: any; body: string }[]) {
  const tfiles = files.map((f) => Object.assign(new TFile(f.path), { path: f.path }));
  return {
    vault: {
      getMarkdownFiles: () => tfiles,
      read: async (f: any) => files.find((x) => x.path === f.path)!.body,
      on: vi.fn(),
    },
    metadataCache: {
      getFileCache: (f: any) => ({ frontmatter: files.find((x) => x.path === f.path)!.fm }),
    },
  } as any;
}

describe("AgentRegistry", () => {
  it("loads only files under the configured folder with agent frontmatter", async () => {
    const app = fakeApp([
      { path: "06. Sistema/SUB-AGENTS/nexo.md", fm: { name: "nexo", tags: ["#agente/estrategia", "#sistema/sub-agente"] }, body: "You are Nexo." },
      { path: "00. Daily Notes/2026-06-19.md", fm: { tags: ["#areas/diario/daily"] }, body: "diary" },
    ]);
    const reg = new AgentRegistry(app, "06. Sistema/SUB-AGENTS");
    await reg.load();
    expect(reg.all().map((a) => a.name)).toEqual(["nexo"]);
  });

  it("notifies subscribers on load", async () => {
    const app = fakeApp([
      { path: "06. Sistema/SUB-AGENTS/nexo.md", fm: { name: "nexo", tags: ["#agente/estrategia", "#sistema/sub-agente"] }, body: "x" },
    ]);
    const reg = new AgentRegistry(app, "06. Sistema/SUB-AGENTS");
    const spy = vi.fn();
    reg.onChange(spy);
    await reg.load();
    expect(spy).toHaveBeenCalledOnce();
  });
});
