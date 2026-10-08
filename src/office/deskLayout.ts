import { CELL_W, CELL_H, MARGIN, WALL_H } from "./officeAssets";

// Pure grid maths for the office floor. No Phaser, so it is testable on its own.

export interface DeskPlacement {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface OfficeLayout {
  roomW: number;
  roomH: number;
  cols: number;
  rows: number;
  placements: DeskPlacement[];
  /** Clear horizontal lane below the last desk row. Wandering agents route through it
   *  instead of walking straight over their colleagues' desks. */
  aisleY: number;
}

export const CELL_STRIDE_X = CELL_W + 64;
export const CELL_STRIDE_Y = CELL_H + 80;
const MIN_ROOM_W = 580;

interface LayoutInput {
  id: string;
  desk?: { col: number; row: number };
}

// A wide room beats a tall one inside an Obsidian pane, and a tall room forces the
// camera to zoom out until the avatars are unreadable. Square-ish grid, never under 3.
export function autoColumns(count: number): number {
  if (count <= 0) return 1;
  return Math.max(3, Math.ceil(Math.sqrt(count)));
}

// Desk positions from the run state win. The grid is only computed when they are
// absent or all identical, which is what a runner that never assigned desks produces.
export function needsAutoPlacement(agents: LayoutInput[]): boolean {
  if (agents.length === 0) return false;
  const valid = agents.filter((a) => (a.desk?.col ?? 0) > 0 && (a.desk?.row ?? 0) > 0);
  if (valid.length !== agents.length) return true;

  const first = valid[0].desk!;
  return valid.every((a) => a.desk!.col === first.col && a.desk!.row === first.row);
}

export function computeOfficeLayout(agents: LayoutInput[]): OfficeLayout {
  const auto = needsAutoPlacement(agents);
  const cols = auto ? autoColumns(agents.length) : 0;

  const placements: DeskPlacement[] = agents.map((a, i) => {
    const col = auto ? (i % cols) + 1 : a.desk!.col;
    const row = auto ? Math.floor(i / cols) + 1 : a.desk!.row;
    return {
      id: a.id,
      col,
      row,
      x: (col - 1) * CELL_STRIDE_X + MARGIN + CELL_STRIDE_X / 2,
      y: (row - 1) * CELL_STRIDE_Y + MARGIN + WALL_H + CELL_STRIDE_Y / 2,
    };
  });

  const maxCol = placements.reduce((m, p) => Math.max(m, p.col), 0) || 1;
  const maxRow = placements.reduce((m, p) => Math.max(m, p.row), 0) || 1;
  const loungeSpace = CELL_H + 48;

  return {
    roomW: Math.max(maxCol * CELL_STRIDE_X + MARGIN * 2, MIN_ROOM_W),
    roomH: maxRow * CELL_STRIDE_Y + MARGIN * 2 + WALL_H + loungeSpace,
    cols: maxCol,
    rows: maxRow,
    placements,
    aisleY: MARGIN + WALL_H + maxRow * CELL_STRIDE_Y + 20,
  };
}
