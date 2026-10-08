import { describe, it, expect, vi } from "vitest";
import {
  HandoffChoreography, bubbleDurationMs, bubbleText,
  type ChoreoActor, type ChoreoStation,
} from "../src/office/HandoffChoreography";
import type { SquadHandoff } from "../src/types";

function handoff(over: Partial<SquadHandoff> = {}): SquadHandoff {
  return { from: "a", to: "b", message: "produced the thing", completedAt: "2026-03-28T10:00:00.000Z", ...over };
}

function makeActor(): ChoreoActor & { log: string[]; releaseWalk: () => void; activity: string } {
  const log: string[] = [];
  let release: (() => void) | null = null;
  return {
    log,
    activity: "seated",
    position: { x: 0, y: 0 },
    claim(a: "handoff") { this.activity = a; log.push("claim"); return true; },
    release() { this.activity = "seated"; log.push("released"); },
    walkTo(x, y) {
      log.push(`walk:${x},${y}`);
      return new Promise<void>((r) => { release = r; });
    },
    returnToSeat() { log.push("return"); return Promise.resolve(); },
    stopMoving() { log.push("stop"); release?.(); release = null; },
    say(text) { log.push(`say:${text}`); },
    hideBubble() { log.push("hide"); },
    releaseWalk() { release?.(); release = null; },
  };
}

function makeDeps(actor: ChoreoActor, station: ChoreoStation | undefined = { visitPosition: { x: 50, y: 60 } }) {
  return {
    getActor: (id: string) => (id === "a" ? actor : undefined),
    getStation: (id: string) => (id === "b" ? station : undefined),
    wait: () => Promise.resolve(),
  };
}

describe("bubble text", () => {
  it("scales duration with length, inside the clamp", () => {
    expect(bubbleDurationMs("hi")).toBe(1800);                    // floor
    expect(bubbleDurationMs("x".repeat(100))).toBe(4000);         // 40ms per char
    expect(bubbleDurationMs("x".repeat(500))).toBe(6000);         // ceiling
  });

  it("truncates a long message with an ellipsis", () => {
    const short = "a short one";
    expect(bubbleText(short)).toBe(short);

    const long = "x".repeat(300);
    const out = bubbleText(long);
    expect(out).toHaveLength(140);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("HandoffChoreography", () => {
  it("walks, speaks, and returns", async () => {
    const actor = makeActor();
    const choreo = new HandoffChoreography(makeDeps(actor));

    const done = choreo.play(handoff());
    await Promise.resolve();
    actor.releaseWalk();
    await done;

    // "stop" first: a delivery yanks the actor out of any ambient errand before claiming it.
    expect(actor.log).toEqual([
      "stop",
      "claim",
      "walk:50,60",
      "say:produced the thing",
      "hide",
      "return",
      "released",
    ]);
  });

  it("stages the same handoff only once", async () => {
    const actor = makeActor();
    const choreo = new HandoffChoreography(makeDeps(actor));
    const h = handoff();

    const first = choreo.play(h);
    await Promise.resolve();
    actor.releaseWalk();
    await first;

    expect(choreo.hasPlayed(h)).toBe(true);
    actor.log.length = 0;
    await choreo.play(h);
    expect(actor.log).toEqual([]);
  });

  it("re-stages when completedAt moves on", async () => {
    const actor = makeActor();
    const choreo = new HandoffChoreography(makeDeps(actor));

    const first = choreo.play(handoff());
    await Promise.resolve(); actor.releaseWalk(); await first;
    actor.log.length = 0;

    const second = choreo.play(handoff({ completedAt: "2026-03-28T11:00:00.000Z" }));
    await Promise.resolve(); actor.releaseWalk(); await second;

    expect(actor.log.filter((l) => l.startsWith("walk:"))).toEqual(["walk:50,60"]);
  });

  it("aborts mid-walk when cancelled, and never finishes the old sequence", async () => {
    const actor = makeActor();
    const choreo = new HandoffChoreography(makeDeps(actor));

    const running = choreo.play(handoff());
    await Promise.resolve();
    expect(actor.log).toEqual(["stop", "claim", "walk:50,60"]);

    // New state lands while the actor is still walking.
    choreo.cancel();
    await running;

    // Stopped and released, but never spoke or returned: the state repositions instead.
    expect(actor.log).toEqual(["stop", "claim", "walk:50,60", "stop", "hide", "released"]);
    expect(actor.activity).toBe("seated");
  });

  it("ignores a handoff naming someone who is not on the floor", async () => {
    const actor = makeActor();
    const choreo = new HandoffChoreography(makeDeps(actor, undefined));

    await choreo.play(handoff({ to: "ghost" }));

    expect(actor.log).toEqual([]);
    // Marked as seen so it is not retried on every state tick.
    expect(choreo.hasPlayed(handoff({ to: "ghost" }))).toBe(true);
  });

  it("focuses the camera on the trip and releases it at the end", async () => {
    const actor = makeActor();
    const onFocus = vi.fn();
    const onFocusEnd = vi.fn();
    const choreo = new HandoffChoreography({ ...makeDeps(actor), onFocus, onFocusEnd });

    const done = choreo.play(handoff());
    await Promise.resolve();
    expect(onFocus).toHaveBeenCalledWith({ x: 0, y: 0 }, { x: 50, y: 60 });

    actor.releaseWalk();
    await done;
    expect(onFocusEnd).toHaveBeenCalled();
  });

  it("forgets staged handoffs after a reset, so a rebuilt cast replays", async () => {
    const actor = makeActor();
    const choreo = new HandoffChoreography(makeDeps(actor));
    const h = handoff();

    const done = choreo.play(h);
    await Promise.resolve(); actor.releaseWalk(); await done;
    expect(choreo.hasPlayed(h)).toBe(true);

    choreo.reset();
    expect(choreo.hasPlayed(h)).toBe(false);
  });
});
