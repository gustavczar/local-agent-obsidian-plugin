import * as fs from "fs";
import * as path from "path";
import type { PhaserAgent, PhaserAgentStatus, SquadState, SquadHandoff } from "../types";

// Watches a folder of `<squad>/state.json` files written by an external pipeline runner
// and emits the active squad's state. Read-only: it never writes under `root`.
//
// This is the only file in the plugin that touches Node APIs. It imports neither Obsidian
// nor Phaser, which is what keeps it testable outside the editor.

export type RunStateErrorKind = "no-root" | "watch-failed";

export interface RunStateError {
  kind: RunStateErrorKind;
  message: string;
}

export interface RunStateSourceOptions {
  root: string;          // absolute path; "" disables the source entirely
  debounceMs?: number;
  pollMs?: number;
}

const AGENT_STATUSES: PhaserAgentStatus[] = ["idle", "working", "done", "checkpoint", "delivering"];
const ACTIVE_SQUAD_STATUSES = ["running", "checkpoint"];

type ScanResult =
  | { kind: "state"; state: SquadState }
  | { kind: "empty" }        // root readable, no state.json anywhere
  | { kind: "unreadable" };  // files exist but none parsed — keep whatever we had

export class RunStateSource {
  private readonly debounceMs: number;
  private readonly pollMs: number;
  private root: string;

  private watchers: fs.FSWatcher[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private changeCbs: ((state: SquadState | null) => void)[] = [];
  private errorCbs: ((err: RunStateError) => void)[] = [];

  private lastEmitted: string | null = null;   // serialized, to suppress duplicate emits
  private selected = "";                       // pinned squad; "" = pick automatically
  private reportedErrors = new Set<RunStateErrorKind>();
  private started = false;

  constructor(opts: RunStateSourceOptions) {
    this.root = opts.root ?? "";
    this.debounceMs = opts.debounceMs ?? 120;
    this.pollMs = opts.pollMs ?? 2000;
  }

  onChange(cb: (state: SquadState | null) => void) { this.changeCbs.push(cb); }
  onError(cb: (err: RunStateError) => void) { this.errorCbs.push(cb); }

  start() {
    if (this.started) return;
    this.started = true;
    this.reportedErrors.clear();

    if (!this.rootIsUsable()) {
      this.reportOnce({ kind: "no-root", message: `Squad state folder not found: ${this.root || "(empty)"}` });
      return;
    }
    this.beginWatching();
    this.scanAndEmit();
  }

  stop() {
    this.started = false;
    for (const w of this.watchers) { try { w.close(); } catch { /* already closed */ } }
    this.watchers = [];
    if (this.pollTimer !== null) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.debounceTimer !== null) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
    this.lastEmitted = null;
  }

  setRoot(root: string) {
    const wasStarted = this.started;
    this.stop();
    this.root = root ?? "";
    if (wasStarted) this.start();
  }

  // Squad folder names that currently hold a state.json, for the settings dropdown.
  listSquads(): string[] {
    if (!this.rootIsUsable()) return [];
    return this.squadDirs().filter((d) => this.statePathExists(d)).sort();
  }

  // Re-read the folder now, without waiting for a filesystem event.
  refresh() {
    if (this.started) this.scanAndEmit();
  }

  // Pin a squad; "" restores automatic selection.
  select(squad: string) {
    if (this.selected === squad) return;
    this.selected = squad;
    this.lastEmitted = null;   // force a re-emit even if the state object is unchanged
    if (this.started) this.scanAndEmit();
  }

  // --- watching ---

  private beginWatching() {
    // Recursive watch covers <root>/<squad>/state.json in one handle. Platforms that
    // refuse it (some Linux kernels, network drives) throw here and we fall back to polling.
    try {
      this.watchers.push(fs.watch(this.root, { recursive: true }, () => this.onFsEvent()));
    } catch (e) {
      this.reportOnce({ kind: "watch-failed", message: `fs.watch unavailable, falling back to polling: ${String(e)}` });
      this.pollTimer = setInterval(() => this.scanAndEmit(), this.pollMs);
    }
  }

  // fs.watch fires several times per write on Windows; collapse the burst.
  private onFsEvent() {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.scanAndEmit();
    }, this.debounceMs);
  }

  // --- scanning ---

  private scanAndEmit() {
    const result = this.scan();
    // "unreadable" means every state.json failed to parse — almost always a read that
    // landed mid-write. Keep showing the last good state instead of blanking the scene.
    if (result.kind === "unreadable") return;

    if (result.kind === "empty") {
      if (this.lastEmitted === null) return;
      this.lastEmitted = null;
      this.emit(null);
      return;
    }

    const serialized = JSON.stringify(result.state);
    if (serialized === this.lastEmitted) return;
    this.lastEmitted = serialized;
    this.emit(result.state);
  }

  private scan(): ScanResult {
    if (!this.rootIsUsable()) return { kind: "empty" };

    const candidates: SquadState[] = [];
    let sawStateFile = false;

    for (const dir of this.squadDirs()) {
      if (!this.statePathExists(dir)) continue;
      sawStateFile = true;
      const parsed = this.readState(dir);
      if (parsed) candidates.push(parsed);
    }

    if (candidates.length === 0) return sawStateFile ? { kind: "unreadable" } : { kind: "empty" };

    const picked = this.pick(candidates);
    // A pinned squad that has no readable state.json right now is a mid-write read,
    // not an empty folder — hold the previous state.
    if (!picked) return { kind: "unreadable" };
    return { kind: "state", state: picked };
  }

  private pick(candidates: SquadState[]): SquadState | null {
    if (this.selected) return candidates.find((c) => c.squad === this.selected) ?? null;
    const active = candidates.filter((c) => ACTIVE_SQUAD_STATUSES.includes(c.status));
    const pool = active.length > 0 ? active : candidates;
    return pool.reduce((best, c) => (updatedMs(c) > updatedMs(best) ? c : best));
  }

  private readState(dir: string): SquadState | null {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(this.root, dir, "state.json"), "utf8");
    } catch {
      return null;      // deleted between listing and reading, or locked mid-write
    }
    try {
      return validateSquadState(JSON.parse(raw), dir);
    } catch {
      return null;      // truncated or malformed JSON
    }
  }

  // --- filesystem helpers ---

  private rootIsUsable(): boolean {
    if (!this.root) return false;
    try { return fs.statSync(this.root).isDirectory(); } catch { return false; }
  }

  private squadDirs(): string[] {
    try {
      return fs.readdirSync(this.root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  private statePathExists(dir: string): boolean {
    try { return fs.statSync(path.join(this.root, dir, "state.json")).isFile(); } catch { return false; }
  }

  // --- emitting ---

  private emit(state: SquadState | null) {
    for (const cb of this.changeCbs) cb(state);
  }

  private reportOnce(err: RunStateError) {
    if (this.reportedErrors.has(err.kind)) return;
    this.reportedErrors.add(err.kind);
    for (const cb of this.errorCbs) cb(err);
  }
}

function updatedMs(s: SquadState): number {
  const t = Date.parse(s.updatedAt);
  return Number.isNaN(t) ? 0 : t;
}

// Shape validation without a schema dependency. Throws on anything unusable; the caller
// treats a throw exactly like a truncated file.
export function validateSquadState(raw: unknown, fallbackSquad: string): SquadState {
  const o = asRecord(raw, "state");
  const agentsRaw = o.agents;
  if (!Array.isArray(agentsRaw)) throw new Error("agents must be an array");

  const step = asRecord(o.step ?? {}, "step");

  return {
    squad: typeof o.squad === "string" && o.squad ? o.squad : fallbackSquad,
    status: o.status === "completed" || o.status === "checkpoint" ? o.status : "running",
    step: {
      current: numberOr(step.current, 0),
      total: numberOr(step.total, 0),
      label: typeof step.label === "string" ? step.label : "",
    },
    agents: dedupeIds(agentsRaw.map((a, i) => validateAgent(a, i))),
    handoff: validateHandoff(o.handoff),
    startedAt: typeof o.startedAt === "string" ? o.startedAt : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
  };
}

// The scene keys stations and actors by id, so a repeated id would make one agent
// vanish without a trace. Suffix instead: a visible oddity beats a silent hole.
function dedupeIds(agents: PhaserAgent[]): PhaserAgent[] {
  const seen = new Set<string>();
  return agents.map((a) => {
    if (!seen.has(a.id)) { seen.add(a.id); return a; }
    let n = 2;
    while (seen.has(`${a.id}#${n}`)) n++;
    const id = `${a.id}#${n}`;
    seen.add(id);
    return { ...a, id };
  });
}

function validateAgent(raw: unknown, index: number): PhaserAgent {
  const a = asRecord(raw, `agents[${index}]`);
  if (typeof a.id !== "string" || !a.id) throw new Error(`agents[${index}].id is required`);
  const desk = asRecord(a.desk ?? {}, `agents[${index}].desk`);
  return {
    id: a.id,
    name: typeof a.name === "string" && a.name ? a.name : a.id,
    icon: typeof a.icon === "string" ? a.icon : "🤖",
    // An unknown status is a runner we don't understand yet, not a reason to drop the agent.
    status: AGENT_STATUSES.includes(a.status as PhaserAgentStatus) ? (a.status as PhaserAgentStatus) : "idle",
    gender: a.gender === "male" || a.gender === "female" ? a.gender : undefined,
    desk: { col: numberOr(desk.col, 0), row: numberOr(desk.row, 0) },
  };
}

function validateHandoff(raw: unknown): SquadHandoff | null {
  if (raw === null || raw === undefined) return null;
  const h = asRecord(raw, "handoff");
  if (typeof h.from !== "string" || typeof h.to !== "string") return null;
  return {
    from: h.from,
    to: h.to,
    message: typeof h.message === "string" ? h.message : "",
    completedAt: typeof h.completedAt === "string" ? h.completedAt : "",
  };
}

function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${what} must be an object`);
  return v as Record<string, unknown>;
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
