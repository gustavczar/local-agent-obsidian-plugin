import { CanvasSpec } from "./buildCanvas";

/** Extracts a {nodes, edges} spec from a model reply (tolerates code fences and surrounding prose). */
export function parseCanvasSpec(reply: string): CanvasSpec | null {
  const fence = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : reply;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  let obj: unknown;
  try { obj = JSON.parse(raw.slice(start, end + 1)); }
  catch { return null; }
  if (!obj || typeof obj !== "object") return null;

  const root = obj as Record<string, unknown>;
  const rawNodes = Array.isArray(root.nodes) ? (root.nodes as unknown[]) : null;
  if (!rawNodes) return null;
  const nodes = rawNodes
    .map((n) => (n && typeof n === "object" ? (n as Record<string, unknown>) : null))
    .filter((n): n is Record<string, unknown> => n != null && n.id != null && n.text != null)
    .map((n) => ({ id: String(n.id), text: String(n.text) }));
  if (!nodes.length) return null;

  const rawEdges = Array.isArray(root.edges) ? (root.edges as unknown[]) : [];
  const edges = rawEdges
    .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>) : null))
    .filter((e): e is Record<string, unknown> => e != null && e.from != null && e.to != null)
    .map((e) => ({ from: String(e.from), to: String(e.to), ...(typeof e.label === "string" ? { label: e.label } : {}) }));

  return { nodes, edges };
}
