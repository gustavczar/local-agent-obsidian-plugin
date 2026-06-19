import { Agent } from "../types";

export interface Pos { x: number; y: number; }
export interface RoomBox { name: string; x: number; y: number; w: number; h: number; }
export interface Node { name: string; title: string; room: string; x: number; y: number; }
export interface Layout { rooms: RoomBox[]; nodes: Node[]; }

export function computeLayout(
  agents: Agent[],
  saved: Record<string, Pos>,
  canvas: { w: number; h: number },
): Layout {
  const roomNames = [...new Set(agents.map((a) => a.room))].sort();
  const cols = Math.ceil(Math.sqrt(roomNames.length)) || 1;
  const rows = Math.ceil(roomNames.length / cols) || 1;
  const rw = canvas.w / cols;
  const rh = canvas.h / rows;
  const pad = 16;

  const rooms: RoomBox[] = roomNames.map((name, i) => ({
    name,
    x: (i % cols) * rw + pad,
    y: Math.floor(i / cols) * rh + pad,
    w: rw - pad * 2,
    h: rh - pad * 2,
  }));
  const roomByName = new Map(rooms.map((r) => [r.name, r]));

  const perRoomCount: Record<string, number> = {};
  const nodes: Node[] = agents.map((a) => {
    const box = roomByName.get(a.room)!;
    if (saved[a.name]) return { name: a.name, title: a.title, room: a.room, ...saved[a.name] };
    const idx = (perRoomCount[a.room] = (perRoomCount[a.room] ?? 0) + 1) - 1;
    const perRow = Math.max(1, Math.floor(box.w / 70));
    const x = box.x + 35 + (idx % perRow) * 70;
    const y = box.y + 45 + Math.floor(idx / perRow) * 60;
    return { name: a.name, title: a.title, room: a.room, x, y };
  });

  return { rooms, nodes };
}
