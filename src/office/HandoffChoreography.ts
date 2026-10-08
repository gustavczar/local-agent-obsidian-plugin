import type { SquadHandoff } from "../types";

// Plays the delivery walk when the run state reports a handoff. Kept free of Phaser so
// the sequencing and interruption rules can be tested with plain doubles.

export interface ChoreoActor {
  walkTo(x: number, y: number): Promise<void>;
  returnToSeat(): Promise<void>;
  stopMoving(): void;
  say(text: string): void;
  hideBubble(): void;
  /** Handoff outranks ambient wandering, so this always succeeds. */
  claim(activity: "handoff"): boolean;
  release(): void;
  readonly position: { x: number; y: number };
}

export interface ChoreoStation {
  readonly visitPosition: { x: number; y: number };
}

export interface ChoreographyDeps {
  getActor(id: string): ChoreoActor | undefined;
  getStation(id: string): ChoreoStation | undefined;
  wait(ms: number): Promise<void>;
  onFocus?(a: { x: number; y: number }, b: { x: number; y: number }): void;
  onFocusEnd?(): void;
}

const MIN_BUBBLE_MS = 1800;
const MAX_BUBBLE_MS = 6000;
const MS_PER_CHAR = 40;
const MAX_BUBBLE_CHARS = 140;

export function bubbleDurationMs(message: string): number {
  const ms = message.length * MS_PER_CHAR;
  return Math.min(MAX_BUBBLE_MS, Math.max(MIN_BUBBLE_MS, ms));
}

export function bubbleText(message: string): string {
  if (message.length <= MAX_BUBBLE_CHARS) return message;
  return message.slice(0, MAX_BUBBLE_CHARS - 1).trimEnd() + "…";
}

export class HandoffChoreography {
  private lastPlayed = "";
  private runToken = 0;
  private active: ChoreoActor | null = null;

  constructor(private deps: ChoreographyDeps) {}

  /** True when this handoff has already been staged, keyed by completedAt. */
  hasPlayed(handoff: SquadHandoff): boolean {
    return this.identity(handoff) === this.lastPlayed;
  }

  /**
   * Stages the delivery. Resolves when the actor is back in its seat, or immediately
   * when the handoff is stale, unstageable, or superseded.
   */
  async play(handoff: SquadHandoff): Promise<void> {
    if (this.hasPlayed(handoff)) return;

    const from = this.deps.getActor(handoff.from);
    const target = this.deps.getStation(handoff.to);
    // The state is the truth: a handoff naming someone who is not on the floor is
    // simply not stageable, and must not block the rest of the update.
    if (!from || !target) {
      this.lastPlayed = this.identity(handoff);
      return;
    }

    this.cancel();
    this.lastPlayed = this.identity(handoff);
    const token = ++this.runToken;
    this.active = from;
    // Takes the actor away from the ambient director mid-errand if need be: a real
    // delivery always outranks a coffee break.
    from.stopMoving();
    from.claim("handoff");

    const origin = { ...from.position };
    this.deps.onFocus?.(origin, target.visitPosition);

    await from.walkTo(target.visitPosition.x, target.visitPosition.y);
    if (token !== this.runToken) return;

    from.say(bubbleText(handoff.message));
    await this.deps.wait(bubbleDurationMs(handoff.message));
    if (token !== this.runToken) return;

    from.hideBubble();
    await from.returnToSeat();
    if (token !== this.runToken) return;

    from.release();
    this.deps.onFocusEnd?.();
    this.active = null;
  }

  /** Aborts a delivery in progress. The caller then repositions from the new state. */
  cancel() {
    if (this.active) {
      this.active.stopMoving();
      this.active.hideBubble();
      this.active.release();
      this.active = null;
    }
    this.runToken++;
    this.deps.onFocusEnd?.();
  }

  /** Forgets what has been staged — used when the cast is rebuilt from scratch. */
  reset() {
    this.cancel();
    this.lastPlayed = "";
  }

  private identity(h: SquadHandoff): string {
    return `${h.from}->${h.to}@${h.completedAt}`;
  }
}
