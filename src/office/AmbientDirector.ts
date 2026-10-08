import type { PhaserAgentStatus } from "../types";
import type { ActorActivity } from "./AgentSprite";
import type { OfficePoints, Point } from "./RoomBuilder";

// Gives the office a pulse between deliveries.
//
// The rule that keeps this honest: only agents that are NOT working may wander.
// "working" means output is being produced, so walking away would misreport it.
// "idle", "done" and "checkpoint" mean the agent is genuinely doing nothing, so showing
// downtime is accurate — and a room with one glowing desk and five people at the coffee
// machine tells you at a glance that exactly one thing is happening.
//
// No ambient behaviour ever renders invented text. Chat bubbles are ellipses; real
// sentences come only from a handoff message.

const RESTLESS: PhaserAgentStatus[] = ["idle", "done", "checkpoint"];

export interface AmbientActor {
  readonly id: string;
  readonly status: PhaserAgentStatus;
  readonly activity: ActorActivity;
  readonly seat: Point;
  readonly position: Point;
  claim(activity: "ambient"): boolean;
  release(): void;
  abort(): void;
  walkPath(points: Point[]): Promise<void>;
  say(text: string): void;
  hideBubble(): void;
}

export interface AmbientDeps {
  getActors(): AmbientActor[];
  getPoints(): OfficePoints | null;
  getAisleY(): number;
  /** Runs cb after ms. Returns a cancel function. */
  schedule(ms: number, cb: () => void): () => void;
  wait(ms: number): Promise<void>;
  random(): number;
  minGapMs?: number;
  maxGapMs?: number;
  maxAway?: number;
  cooldownMs?: number;
}

/**
 * Routes around the desks instead of over them. With no collision system, a straight
 * line from a desk to the coffee pot walks right across three colleagues' monitors.
 * Dropping into the clear aisle first costs nothing and removes the ugliest artefact.
 */
export function aisleRoute(from: Point, to: Point, aisleY: number): Point[] {
  if (Math.abs(from.y - to.y) < 24) return [to];        // same lane already
  return [{ x: from.x, y: aisleY }, { x: to.x, y: aisleY }, to];
}

type Behaviour = "coffee" | "water" | "lounge" | "chat";

export class AmbientDirector {
  private cancelTick: (() => void) | null = null;
  private running = false;
  private away = new Set<string>();
  private cooldownUntil = new Map<string, number>();
  private tokens = new Map<string, number>();
  private now = 0;

  private readonly minGap: number;
  private readonly maxGap: number;
  private readonly maxAway: number;
  private readonly cooldown: number;

  constructor(private deps: AmbientDeps) {
    this.minGap = deps.minGapMs ?? 4000;
    this.maxGap = deps.maxGapMs ?? 9000;
    this.maxAway = deps.maxAway ?? 2;
    this.cooldown = deps.cooldownMs ?? 25000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.queueTick();
  }

  stop() {
    this.running = false;
    this.cancelTick?.();
    this.cancelTick = null;
    for (const id of [...this.away]) this.abort(id);
  }

  /**
   * Called whenever run state changes. Anyone who started working while wandering is
   * pulled back immediately: the state is the truth, the animation is not.
   */
  syncWithState() {
    for (const actor of this.deps.getActors()) {
      if (!this.away.has(actor.id)) continue;
      if (!RESTLESS.includes(actor.status)) void this.sendHome(actor);
    }
  }

  /** Wandering agents, for tests and for the scene to know who is not at a desk. */
  wandering(): string[] { return [...this.away]; }

  // --- scheduling ---

  private queueTick() {
    if (!this.running) return;
    const gap = this.minGap + this.deps.random() * (this.maxGap - this.minGap);
    this.cancelTick = this.deps.schedule(gap, () => {
      this.now += gap;
      this.tick();
      this.queueTick();
    });
  }

  private tick() {
    if (this.away.size >= this.maxAway) return;
    const points = this.deps.getPoints();
    if (!points) return;

    const free = this.eligible();
    if (free.length === 0) return;

    const behaviour = this.pickBehaviour(free.length);
    const actor = free[Math.floor(this.deps.random() * free.length)];

    if (behaviour === "chat") {
      const partner = free.find((a) => a.id !== actor.id);
      if (partner) { void this.runChat(actor, partner); return; }
    }
    void this.runErrand(actor, behaviour === "lounge" ? this.pickLoungeSeat(points) : this.pickSpot(points, behaviour));
  }

  private eligible(): AmbientActor[] {
    return this.deps.getActors().filter((a) =>
      a.activity === "seated" &&
      RESTLESS.includes(a.status) &&
      !this.away.has(a.id) &&
      (this.cooldownUntil.get(a.id) ?? 0) <= this.now);
  }

  private pickBehaviour(freeCount: number): Behaviour {
    const roll = this.deps.random();
    if (freeCount >= 2 && roll < 0.3) return "chat";
    if (roll < 0.55) return "coffee";
    if (roll < 0.8) return "water";
    return "lounge";
  }

  private pickSpot(points: OfficePoints, behaviour: Behaviour): Point {
    return behaviour === "water" ? points.waterCooler : points.coffee;
  }

  private pickLoungeSeat(points: OfficePoints): Point {
    const seats = points.loungeSeats;
    return seats[Math.floor(this.deps.random() * seats.length)] ?? points.coffee;
  }

  // --- behaviours ---

  private async runErrand(actor: AmbientActor, spot: Point) {
    if (!this.take(actor)) return;
    const token = this.tokens.get(actor.id)!;
    const aisle = this.deps.getAisleY();

    await actor.walkPath(aisleRoute(actor.position, spot, aisle));
    if (!this.stillMine(actor, token)) return;

    await this.deps.wait(2500 + this.deps.random() * 6000);
    if (!this.stillMine(actor, token)) return;

    await this.finishAtSeat(actor, token);
  }

  private async runChat(a: AmbientActor, b: AmbientActor) {
    if (!this.take(a)) return;
    if (!this.take(b)) { await this.finishAtSeat(a, this.tokens.get(a.id)!); return; }

    const tokenA = this.tokens.get(a.id)!, tokenB = this.tokens.get(b.id)!;
    const aisle = this.deps.getAisleY();
    const meet = { x: (a.seat.x + b.seat.x) / 2, y: aisle };

    await Promise.all([
      a.walkPath(aisleRoute(a.position, { x: meet.x - 42, y: meet.y }, aisle)),
      b.walkPath(aisleRoute(b.position, { x: meet.x + 42, y: meet.y }, aisle)),
    ]);
    if (!this.stillMine(a, tokenA) || !this.stillMine(b, tokenB)) {
      await Promise.all([this.finishAtSeat(a, tokenA), this.finishAtSeat(b, tokenB)]);
      return;
    }

    // Ellipses only. Putting words in their mouths would be inventing work.
    for (let turn = 0; turn < 3; turn++) {
      const speaker = turn % 2 === 0 ? a : b;
      const listener = turn % 2 === 0 ? b : a;
      listener.hideBubble();
      speaker.say("…");
      await this.deps.wait(1400);
      if (!this.stillMine(a, tokenA) || !this.stillMine(b, tokenB)) break;
    }

    a.hideBubble(); b.hideBubble();
    await Promise.all([this.finishAtSeat(a, tokenA), this.finishAtSeat(b, tokenB)]);
  }

  // --- ownership bookkeeping ---

  private take(actor: AmbientActor): boolean {
    if (!actor.claim("ambient")) return false;
    this.away.add(actor.id);
    this.tokens.set(actor.id, (this.tokens.get(actor.id) ?? 0) + 1);
    return true;
  }

  private stillMine(actor: AmbientActor, token: number): boolean {
    return this.running
      && this.tokens.get(actor.id) === token
      && this.away.has(actor.id)
      && actor.activity === "ambient";
  }

  private async finishAtSeat(actor: AmbientActor, token: number) {
    actor.hideBubble();
    if (this.tokens.get(actor.id) === token && actor.activity === "ambient") {
      await actor.walkPath(aisleRoute(actor.position, actor.seat, this.deps.getAisleY()));
    }
    this.settle(actor);
  }

  private async sendHome(actor: AmbientActor) {
    const token = (this.tokens.get(actor.id) ?? 0) + 1;
    this.tokens.set(actor.id, token);   // invalidates the errand still in flight
    actor.hideBubble();
    if (actor.activity === "ambient") {
      await actor.walkPath(aisleRoute(actor.position, actor.seat, this.deps.getAisleY()));
    }
    this.settle(actor);
  }

  private settle(actor: AmbientActor) {
    this.away.delete(actor.id);
    if (actor.activity === "ambient") actor.release();
    this.cooldownUntil.set(actor.id, this.now + this.cooldown);
  }

  private abort(id: string) {
    const actor = this.deps.getActors().find((a) => a.id === id);
    this.away.delete(id);
    this.tokens.set(id, (this.tokens.get(id) ?? 0) + 1);
    if (actor && actor.activity === "ambient") actor.abort();
  }
}
