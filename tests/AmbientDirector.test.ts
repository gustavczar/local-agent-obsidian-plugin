import { describe, it, expect } from "vitest";
import { AmbientDirector, aisleRoute, type AmbientActor } from "../src/office/AmbientDirector";
import type { PhaserAgentStatus } from "../src/types";
import type { ActorActivity } from "../src/office/AgentSprite";

// A clock the test drives by hand: no real timers, so behaviour is deterministic.
class FakeClock {
  private queue: { at: number; cb: () => void; cancelled: boolean }[] = [];
  now = 0;

  schedule = (ms: number, cb: () => void) => {
    const item = { at: this.now + ms, cb, cancelled: false };
    this.queue.push(item);
    return () => { item.cancelled = true; };
  };

  wait = (ms: number) => new Promise<void>((r) => this.schedule(ms, r));

  /** Runs everything due within `ms`, letting awaited promises settle in between. */
  async advance(ms: number) {
    const target = this.now + ms;
    for (let guard = 0; guard < 500; guard++) {
      const next = this.queue
        .filter((i) => !i.cancelled && i.at <= target)
        .sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.queue = this.queue.filter((i) => i !== next);
      this.now = next.at;
      next.cb();
      await Promise.resolve(); await Promise.resolve();
    }
    this.now = target;
  }
}

function makeActor(id: string, status: PhaserAgentStatus, x = 100): AmbientActor & { log: string[] } {
  let activity: ActorActivity = "seated";
  const log: string[] = [];
  const seat = { x, y: 200 };
  const pos = { ...seat };
  return {
    id, log, seat,
    get status() { return status; },
    get activity() { return activity; },
    get position() { return pos; },
    claim(a) { if (activity !== "seated") return false; activity = a; log.push("claim"); return true; },
    release() { activity = "seated"; log.push("release"); },
    abort() { activity = "seated"; log.push("abort"); },
    async walkPath(points) {
      log.push(`walk:${points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(">")}`);
      const last = points[points.length - 1];
      if (last) { pos.x = last.x; pos.y = last.y; }
    },
    say(t) { log.push(`say:${t}`); },
    hideBubble() { log.push("hide"); },
    // test helper to flip status mid-flight
    setStatus(s: PhaserAgentStatus) { status = s; },
    forceActivity(a: ActorActivity) { activity = a; },
  } as AmbientActor & { log: string[]; setStatus(s: PhaserAgentStatus): void; forceActivity(a: ActorActivity): void };
}

const POINTS = {
  coffee: { x: 500, y: 600 },
  waterCooler: { x: 700, y: 120 },
  loungeSeats: [{ x: 400, y: 640 }],
};

function makeDirector(actors: AmbientActor[], rolls: number[] = [0.5]) {
  const clock = new FakeClock();
  let i = 0;
  const director = new AmbientDirector({
    getActors: () => actors,
    getPoints: () => POINTS,
    getAisleY: () => 400,
    schedule: clock.schedule,
    wait: clock.wait,
    random: () => rolls[i++ % rolls.length],
    minGapMs: 1000, maxGapMs: 1000, cooldownMs: 50000,
  });
  return { director, clock };
}

describe("aisleRoute", () => {
  it("drops into the aisle before crossing, instead of walking over desks", () => {
    expect(aisleRoute({ x: 100, y: 200 }, { x: 500, y: 600 }, 400)).toEqual([
      { x: 100, y: 400 }, { x: 500, y: 400 }, { x: 500, y: 600 },
    ]);
  });

  it("walks straight when already in the same lane", () => {
    expect(aisleRoute({ x: 100, y: 400 }, { x: 500, y: 410 }, 400)).toEqual([{ x: 500, y: 410 }]);
  });
});

describe("AmbientDirector — who may wander", () => {
  it("never moves an agent that is working", async () => {
    const busy = makeActor("busy", "working");
    const { director, clock } = makeDirector([busy]);
    director.start();
    await clock.advance(20000);
    director.stop();

    expect(busy.log).toEqual([]);
  });

  it("never moves an agent that is delivering", async () => {
    const delivering = makeActor("d", "delivering");
    const { director, clock } = makeDirector([delivering]);
    director.start();
    await clock.advance(20000);
    director.stop();

    expect(delivering.log).toEqual([]);
  });

  it("sends an idle agent on an errand and brings it back to its seat", async () => {
    const idle = makeActor("idle", "idle");
    const { director, clock } = makeDirector([idle], [0.4]);   // 0.4 -> coffee
    director.start();
    await clock.advance(30000);

    expect(idle.log[0]).toBe("claim");
    expect(idle.log.some((l) => l.startsWith("walk:"))).toBe(true);
    expect(idle.log).toContain("release");
    expect(idle.position).toEqual(idle.seat);
  });

  it("leaves a done or checkpoint agent free to wander", async () => {
    const done = makeActor("done", "done");
    const { director, clock } = makeDirector([done], [0.4]);
    director.start();
    await clock.advance(10000);
    director.stop();

    expect(done.log).toContain("claim");
  });
});

describe("AmbientDirector — limits", () => {
  it("keeps at most two agents away from their desks", async () => {
    const actors = ["a", "b", "c", "d", "e"].map((id) => makeActor(id, "idle"));
    const { director, clock } = makeDirector(actors, [0.9]);   // 0.9 -> lounge, long stay
    director.start();
    await clock.advance(6000);

    expect(director.wandering().length).toBeLessThanOrEqual(2);
    director.stop();
  });

  it("does not touch an actor the choreography already owns", async () => {
    const claimed = makeActor("c", "idle") as AmbientActor & { log: string[]; forceActivity(a: ActorActivity): void };
    claimed.forceActivity("handoff");
    const { director, clock } = makeDirector([claimed], [0.4]);
    director.start();
    await clock.advance(20000);
    director.stop();

    expect(claimed.log).toEqual([]);
  });
});

describe("AmbientDirector — state wins over animation", () => {
  it("pulls a wanderer home the moment it starts working", async () => {
    const actor = makeActor("a", "idle") as AmbientActor & { log: string[]; setStatus(s: PhaserAgentStatus): void };
    const { director, clock } = makeDirector([actor], [0.9]);  // lounge: long dwell
    director.start();
    await clock.advance(1500);
    expect(director.wandering()).toEqual(["a"]);

    actor.setStatus("working");
    director.syncWithState();
    await clock.advance(100);

    expect(director.wandering()).toEqual([]);
    expect(actor.position).toEqual(actor.seat);
    expect(actor.log).toContain("release");
  });

  it("releases everyone on stop", async () => {
    const actor = makeActor("a", "idle") as AmbientActor & { log: string[] };
    const { director, clock } = makeDirector([actor], [0.9]);
    director.start();
    await clock.advance(1500);
    expect(director.wandering()).toEqual(["a"]);

    director.stop();
    expect(director.wandering()).toEqual([]);
    expect(actor.activity).toBe("seated");
  });
});

describe("AmbientDirector — chat never invents words", () => {
  it("speaks only ellipses", async () => {
    const a = makeActor("a", "idle", 100);
    const b = makeActor("b", "idle", 300);
    const { director, clock } = makeDirector([a, b], [0.1]);   // 0.1 -> chat
    director.start();
    await clock.advance(20000);
    director.stop();

    const spoken = [...a.log, ...b.log].filter((l) => l.startsWith("say:"));
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken.every((l) => l === "say:…")).toBe(true);
  });
});
