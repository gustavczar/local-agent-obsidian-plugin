export interface CanvasSpecNode { id: string; text: string; }
export interface CanvasSpecEdge { from: string; to: string; label?: string; }
export interface CanvasSpec { nodes: CanvasSpecNode[]; edges: CanvasSpecEdge[]; }

interface JCNode { id: string; type: "text"; text: string; x: number; y: number; width: number; height: number; }
interface JCEdge { id: string; fromNode: string; toNode: string; label?: string; }

const W = 260, H = 120, GAP_X = 80, GAP_Y = 70;

/** Converts a simplified spec into a valid JSON Canvas (.canvas) document with a grid layout. */
export function buildCanvas(spec: CanvasSpec): string {
  const cols = Math.max(1, Math.ceil(Math.sqrt(spec.nodes.length)));
  const nodes: JCNode[] = spec.nodes.map((nd, i) => ({
    id: nd.id,
    type: "text",
    text: nd.text,
    x: (i % cols) * (W + GAP_X),
    y: Math.floor(i / cols) * (H + GAP_Y),
    width: W,
    height: H,
  }));

  const ids = new Set(nodes.map((n) => n.id));
  const edges: JCEdge[] = spec.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e, i) => ({ id: `e${i + 1}`, fromNode: e.from, toNode: e.to, ...(e.label ? { label: e.label } : {}) }));

  return JSON.stringify({ nodes, edges }, null, 2);
}
