import type { PhaserAgent, PhaserAgentStatus } from "../types";

// Texture keys ARE the asset paths. Phaser registers each texture under its path in
// OfficeScene.preload(), so every consumer here can reference the constant directly.
// Registering under the object key instead is what produced the green __MISSING boxes.

export const CHARACTER_NAMES = [
  "Male1", "Male2", "Male3", "Male4",
  "Female1", "Female2", "Female3", "Female4", "Female5", "Female6",
];

const MALE_CHARACTERS = ["Male1", "Male2", "Male3", "Male4"];
const FEMALE_CHARACTERS = ["Female1", "Female2", "Female3", "Female4", "Female5", "Female6"];

export function avatarKeys(name: string) {
  const base = `avatars/${name}`;
  return { blink: `${base}_blink.png`, talk: `${base}_talk.png` };
}

// The `_up` variants show the back of the monitor, which is what puts the screen in
// front of the agent instead of in front of the viewer. There is no `_up_coding`
// variant, so the "screen is on" cue comes from the glow drawn in Station instead.
export const DESK_KEYS = {
  blackFacingAgent: "desks/desktop_set_black_up.png",
  whiteFacingAgent: "desks/desktop_set_white_up.png",
};

export const FURNITURE_KEYS = {
  deskWood: "furniture/desk_wood.png",
  coffeeMug: "furniture/coffee_mug.png",
  blindsLargeWhite: "furniture/blinds_large_closed_white.png",
  bookshelfPurpleTall: "furniture/bookshelf_purple_tall.png",
  whiteboardStandGraph: "furniture/whiteboard_stand_graph.png",
  monstera: "furniture/monstera.png",
  waterCooler: "furniture/water_cooler_better.png",
  plant3: "furniture/plant3.png",
  plantPoof: "furniture/plant_poof.png",
  treasurechestGold: "furniture/treasurechest_closed_gold.png",
  monsteraSmall: "furniture/monstera_small.png",
  plant1: "furniture/plant1.png",
  fancyRugWide: "furniture/fancy_rug_wide.png",
  couchTanDown: "furniture/couch_tan_down.png",
  cushionBlue: "furniture/cushion_blue.png",
  cushionTan: "furniture/cushion_tan.png",
  armchairTanDown: "furniture/armchair_tan_down.png",
  coffeeTable: "furniture/coffee_table.png",
  coffeeMugBlue: "furniture/coffee_mug_blue.png",
  coffeetableBlackH: "furniture/coffeetable_black_horizontal.png",
  coffeepotRight: "furniture/coffeepot_right.png",
};

export const COLORS = {
  floor: 0x2d2538,
  floorAlt: 0x3a304d,
  wall: 0x3d334f,
  wallTrim: 0x2a2238,
  screenGlow: 0x7dd3fc,
  statusIdle: 0x6b7280,
  statusWorking: 0x10b981,
  statusDone: 0x3b82f6,
  statusCheckpoint: 0xf59e0b,
};

export const TILE = 32;
export const MARGIN = 40;
export const WALL_H = 60;
export const CELL_W = 96;
export const CELL_H = 96;
export const AVATAR_SCALE = 0.8;

export const STATUS_COLORS: Record<PhaserAgentStatus, number> = {
  idle: COLORS.statusIdle,
  working: COLORS.statusWorking,
  done: COLORS.statusDone,
  checkpoint: COLORS.statusCheckpoint,
  delivering: COLORS.statusWorking,
};

export const STATUS_LABELS: Record<PhaserAgentStatus, string> = {
  idle: "idle", working: "working", done: "done",
  checkpoint: "checkpoint", delivering: "delivering",
};

export function statusHexColor(status: PhaserAgentStatus): string {
  return "#" + (STATUS_COLORS[status] ?? COLORS.statusIdle).toString(16).padStart(6, "0");
}

// Stable per-agent character: the same id always gets the same sprite, so an agent
// keeps its face across re-renders. Order-based assignment would reshuffle every time
// the cast changed.
export function assignCharacters(agents: Pick<PhaserAgent, "id" | "gender">[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();

  for (const agent of agents) {
    const pool = agent.gender === "male" ? MALE_CHARACTERS : FEMALE_CHARACTERS;
    const start = hashString(agent.id) % pool.length;
    let picked = pool[start];
    for (let i = 0; i < pool.length && used.has(picked); i++) {
      picked = pool[(start + i + 1) % pool.length];
    }
    used.add(picked);
    out.set(agent.id, picked);
  }
  return out;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
