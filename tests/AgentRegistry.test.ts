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

describe("AgentRegistry — duplicate names", () => {
  // A copied agent file keeps the original's frontmatter `name`. It used to overwrite
  // the original in the map, so both the copy and the original went missing silently.
  const dupes = () => fakeApp([
    { path: "Agents/ledger.md", fm: { name: "ledger" }, body: "You are Ledger." },
    { path: "Agents/teste.md", fm: { name: "ledger" }, body: "A copy." },
  ]);

  it("keeps the first file and does not lose it to the copy", async () => {
    const reg = new AgentRegistry(dupes(), "Agents");
    await reg.load();

    expect(reg.all()).toHaveLength(1);
    expect(reg.get("ledger")!.filePath).toBe("Agents/ledger.md");
  });

  it("reports the ignored file so the user can be told why it vanished", async () => {
    const reg = new AgentRegistry(dupes(), "Agents");
    await reg.load();

    expect(reg.duplicates()).toEqual([
      { name: "ledger", kept: "Agents/ledger.md", ignored: "Agents/teste.md" },
    ]);
  });

  it("reports nothing for a clean folder", async () => {
    const reg = new AgentRegistry(fakeApp([
      { path: "Agents/a.md", fm: { name: "a" }, body: "x" },
      { path: "Agents/b.md", fm: { name: "b" }, body: "y" },
    ]), "Agents");
    await reg.load();

    expect(reg.duplicates()).toEqual([]);
  });
});
