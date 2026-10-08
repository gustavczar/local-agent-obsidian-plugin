import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// fs.watch cannot be spied on: an ESM namespace object is not configurable.
const watchControl = vi.hoisted(() => ({ shouldThrow: false }));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const watch: typeof actual.watch = (...args: Parameters<typeof actual.watch>) => {
    if (watchControl.shouldThrow) throw new Error("ENOSYS");
    return actual.watch(...args);
  };
  return { ...actual, default: { ...actual, watch }, watch };
});

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RunStateSource, validateSquadState } from "../src/office/RunStateSource";
import type { SquadState } from "../src/types";

let root: string;
const sources: RunStateSource[] = [];

function makeState(over: Partial<Record<string, unknown>> = {}) {
  return {
    squad: "s", status: "running",
    step: { current: 1, total: 3, label: "step" },
    agents: [{ id: "a", name: "Ana", icon: "🔍", gender: "female", status: "working", desk: { col: 1, row: 1 } }],
    handoff: null,
    startedAt: "2026-03-28T10:00:00.000Z",
    updatedAt: "2026-03-28T10:00:00.000Z",
    ...over,
  };
}

function writeSquad(name: string, state: unknown | string) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "state.json"), typeof state === "string" ? state : JSON.stringify(state, null, 2));
}

function snapshot(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...snapshot(p));
    else out.push(`${path.relative(root, p)}:${fs.readFileSync(p, "utf8").length}`);
  }
  return out.sort();
}

// Drives the source synchronously: no fs.watch, no debounce timing in the assertions.
function collect(src: RunStateSource) {
  const seen: (SquadState | null)[] = [];
  src.onChange((s) => seen.push(s));
  return seen;
}

function newSource(opts: Partial<{ root: string; debounceMs: number; pollMs: number }> = {}) {
  const s = new RunStateSource({ root, debounceMs: 5, pollMs: 20, ...opts });
  sources.push(s);
  return s;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "lao-runstate-"));
});

afterEach(() => {
  for (const s of sources.splice(0)) s.stop();
  vi.restoreAllMocks();
  watchControl.shouldThrow = false;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("RunStateSource — selection", () => {
  it("picks the active squad with the most recent updatedAt", () => {
    writeSquad("old-running", makeState({ squad: "old-running", updatedAt: "2026-03-28T10:00:00.000Z" }));
    writeSquad("new-running", makeState({ squad: "new-running", updatedAt: "2026-03-28T12:00:00.000Z" }));
    writeSquad("newest-done", makeState({ squad: "newest-done", status: "completed", updatedAt: "2026-03-28T23:00:00.000Z" }));

    const src = newSource();
    const seen = collect(src);
    src.start();

    // The completed squad is newer, but an active one always wins.
    expect(seen.at(-1)?.squad).toBe("new-running");
  });

  it("falls back to the most recent squad when none is active", () => {
    writeSquad("a", makeState({ squad: "a", status: "completed", updatedAt: "2026-03-28T10:00:00.000Z" }));
    writeSquad("b", makeState({ squad: "b", status: "completed", updatedAt: "2026-03-28T20:00:00.000Z" }));

    const src = newSource();
    const seen = collect(src);
    src.start();

    expect(seen.at(-1)?.squad).toBe("b");
  });

  it("honours a pinned squad over the automatic choice", () => {
    writeSquad("a", makeState({ squad: "a", updatedAt: "2026-03-28T10:00:00.000Z" }));
    writeSquad("b", makeState({ squad: "b", updatedAt: "2026-03-28T20:00:00.000Z" }));

    const src = newSource();
    const seen = collect(src);
    src.start();
    expect(seen.at(-1)?.squad).toBe("b");

    src.select("a");
    expect(seen.at(-1)?.squad).toBe("a");
  });

  it("lists only folders that hold a state.json", () => {
    writeSquad("has-state", makeState());
    fs.mkdirSync(path.join(root, "no-state"), { recursive: true });

    const src = newSource();
    src.start();

    expect(src.listSquads()).toEqual(["has-state"]);
  });
});

describe("RunStateSource — tolerating bad reads", () => {
  it("keeps the last good state when a read lands mid-write", () => {
    writeSquad("s", makeState({ updatedAt: "2026-03-28T10:00:00.000Z" }));
    const src = newSource();
    const seen = collect(src);
    src.start();
    expect(seen).toHaveLength(1);
    const good = seen[0];

    // Simulate the runner's Write tool caught halfway through.
    writeSquad("s", '{ "squad": "s", "status": "run');
    src.refresh();

    // No new emit, and nothing blanked out.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(good);
  });

  it("drops one malformed squad without losing the readable ones", () => {
    writeSquad("broken", "{ not json");
    writeSquad("fine", makeState({ squad: "fine" }));

    const src = newSource();
    const seen = collect(src);
    src.start();

    expect(seen.at(-1)?.squad).toBe("fine");
  });

  it("treats a missing required field as unusable", () => {
    // agents must be an array; a string is not recoverable
    expect(() => validateSquadState({ ...makeState(), agents: "nope" }, "s")).toThrow();
    // an agent without an id cannot be placed at a desk
    expect(() => validateSquadState({ ...makeState(), agents: [{ name: "no id" }] }, "s")).toThrow();
  });

  it("emits null for a folder with no state.json at all", () => {
    const src = newSource();
    const seen = collect(src);
    src.start();

    expect(seen).toEqual([]);          // nothing to show, nothing emitted yet
    writeSquad("s", makeState());
    src.refresh();
    expect(seen.at(-1)?.squad).toBe("s");

    fs.rmSync(path.join(root, "s"), { recursive: true, force: true });
    src.refresh();
    expect(seen.at(-1)).toBeNull();
  });

  it("falls back to idle for an unknown agent status", () => {
    const state = validateSquadState({ ...makeState(), agents: [{ id: "a", status: "vibing" }] }, "s");
    expect(state.agents[0].status).toBe("idle");
  });

  it("reports a missing root once per session, not once per scan", () => {
    const src = new RunStateSource({ root: path.join(root, "does-not-exist") });
    sources.push(src);
    const errs: string[] = [];
    src.onError((e) => errs.push(e.kind));

    src.start();
    src.refresh();
    src.refresh();

    expect(errs).toEqual(["no-root"]);
  });

  it("re-reports after an explicit restart, so a corrected setting still gives feedback", () => {
    const src = new RunStateSource({ root: path.join(root, "does-not-exist") });
    sources.push(src);
    const errs: string[] = [];
    src.onError((e) => errs.push(e.kind));

    src.start();
    src.stop();
    src.start();

    // Silence here would leave the user with no signal after fixing the path wrong twice.
    expect(errs).toEqual(["no-root", "no-root"]);
  });
});

describe("RunStateSource — watching", () => {
  it("collapses a burst of fs events into a single emit", async () => {
    writeSquad("s", makeState({ updatedAt: "2026-03-28T10:00:00.000Z" }));
    const src = newSource({ debounceMs: 30 });
    const seen = collect(src);
    src.start();
    expect(seen).toHaveLength(1);

    // Three writes in quick succession, the way a real save fires 2-3 fs.watch events.
    for (const t of ["11", "12", "13"]) {
      writeSquad("s", makeState({ updatedAt: `2026-03-28T${t}:00:00.000Z` }));
    }
    await new Promise((r) => setTimeout(r, 200));

    // One extra emit, not three.
    expect(seen).toHaveLength(2);
    expect(seen.at(-1)?.updatedAt).toBe("2026-03-28T13:00:00.000Z");
  });

  it("falls back to polling when fs.watch throws", async () => {
    writeSquad("s", makeState({ updatedAt: "2026-03-28T10:00:00.000Z" }));
    watchControl.shouldThrow = true;

    const src = newSource({ pollMs: 20 });
    const seen = collect(src);
    const errs: string[] = [];
    src.onError((e) => errs.push(e.kind));
    src.start();

    expect(errs).toEqual(["watch-failed"]);
    expect(seen).toHaveLength(1);

    writeSquad("s", makeState({ updatedAt: "2026-03-28T14:00:00.000Z" }));
    await new Promise((r) => setTimeout(r, 120));

    expect(seen.at(-1)?.updatedAt).toBe("2026-03-28T14:00:00.000Z");
  });

  it("does not emit twice for an unchanged state", async () => {
    writeSquad("s", makeState());
    const src = newSource({ debounceMs: 5 });
    const seen = collect(src);
    src.start();

    writeSquad("s", makeState());      // byte-identical rewrite
    await new Promise((r) => setTimeout(r, 120));

    expect(seen).toHaveLength(1);
  });
});

describe("RunStateSource — read-only", () => {
  it("never writes under root", async () => {
    writeSquad("a", makeState({ squad: "a" }));
    writeSquad("b", makeState({ squad: "b", status: "completed" }));
    const before = snapshot(root);

    const src = newSource();
    src.start();
    src.listSquads();
    src.select("b");
    await new Promise((r) => setTimeout(r, 60));
    src.stop();

    expect(snapshot(root)).toEqual(before);
  });
});

describe("RunStateSource — duplicate ids", () => {
  it("keeps every agent when the runner repeats an id", () => {
    const state = validateSquadState({
      squad: "s", status: "running", step: { current: 1, total: 1, label: "" },
      agents: [
        { id: "writer", name: "One", status: "working", desk: { col: 1, row: 1 } },
        { id: "writer", name: "Two", status: "idle", desk: { col: 2, row: 1 } },
        { id: "writer", name: "Three", status: "idle", desk: { col: 3, row: 1 } },
      ],
      handoff: null, startedAt: "", updatedAt: "",
    }, "s");

    // Three agents in, three out — none swallowed by the id collision.
    expect(state.agents).toHaveLength(3);
    expect(state.agents.map((a) => a.id)).toEqual(["writer", "writer#2", "writer#3"]);
    expect(state.agents.map((a) => a.name)).toEqual(["One", "Two", "Three"]);
  });
});
