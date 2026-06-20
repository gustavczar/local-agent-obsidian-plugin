export interface CanvasSpecNode { id: string; text: string; }
export interface CanvasSpecEdge { from: string; to: string; label?: string; }
export interface CanvasSpec { nodes: CanvasSpecNode[]; edges: CanvasSpecEdge[]; }

interface JCNode { id: string; type: "text"; text: string; x: number; y: number; width: number; height: number; color?: string; }
interface JCEdge { id: string; fromNode: string; toNode: string; label?: string; }

const W = 250, H = 110, GAP_X = 60, GAP_Y = 90;
const LEVEL_COLOR = ["6", "5", "4", "2"]; // Obsidian canvas colors by depth (purple→cyan→green→orange)

/** Computes a depth (BFS level) for each node from the edges; roots = no incoming edge. */
function depths(nodes: CanvasSpecNode[], edges: CanvasSpecEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) { out.set(n.id, []); indeg.set(n.id, 0); }
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    out.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const depth = new Map<string, number>();
  let queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (!queue.length && nodes.length) queue = [nodes[0].id]; // cyclic fallback
  for (const id of queue) depth.set(id, 0);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const d = depth.get(id) ?? 0;
    for (const next of out.get(id) ?? []) {
      if (!depth.has(next)) { depth.set(next, d + 1); queue.push(next); }
    }
  }
  let maxD = 0;
  for (const d of depth.values()) maxD = Math.max(maxD, d);
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, maxD + 1); // unreached
  return depth;
}

/** Converts a simplified spec into a valid JSON Canvas (.canvas) with a hierarchical layout. */
export function buildCanvas(spec: CanvasSpec): string {
  const depth = depths(spec.nodes, spec.edges);
  const perLevel = new Map<number, number>();

  const nodes: JCNode[] = spec.nodes.map((nd) => {
    const d = depth.get(nd.id) ?? 0;
    const col = perLevel.get(d) ?? 0;
    perLevel.set(d, col + 1);
    return {
      id: nd.id,
      type: "text",
      text: nd.text,
      x: col * (W + GAP_X),
      y: d * (H + GAP_Y),
      width: W,
      height: H,
      color: LEVEL_COLOR[d % LEVEL_COLOR.length],
    };
  });

  const ids = new Set(nodes.map((n) => n.id));
  const edges: JCEdge[] = spec.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e, i) => ({ id: `e${i + 1}`, fromNode: e.from, toNode: e.to, ...(e.label ? { label: e.label } : {}) }));

  return JSON.stringify({ nodes, edges }, null, 2);
}
