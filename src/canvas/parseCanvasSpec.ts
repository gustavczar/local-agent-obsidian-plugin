import { CanvasSpec } from "./buildCanvas";

/** Extracts a {nodes, edges} spec from a model reply (tolerates code fences and surrounding prose). */
export function parseCanvasSpec(reply: string): CanvasSpec | null {
  const fence = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : reply;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  let obj: any;
  try { obj = JSON.parse(raw.slice(start, end + 1)); }
  catch { return null; }

  if (!obj || !Array.isArray(obj.nodes)) return null;
  const nodes = obj.nodes
    .filter((n: any) => n && n.id != null && n.text != null)
    .map((n: any) => ({ id: String(n.id), text: String(n.text) }));
  if (!nodes.length) return null;

  const edges = Array.isArray(obj.edges)
    ? obj.edges
        .filter((e: any) => e && e.from != null && e.to != null)
        .map((e: any) => ({ from: String(e.from), to: String(e.to), ...(e.label != null ? { label: String(e.label) } : {}) }))
    : [];

  return { nodes, edges };
}
