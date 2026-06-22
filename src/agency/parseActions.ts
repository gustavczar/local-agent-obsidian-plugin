import { AgentAction } from "../types";

// Extracts the first balanced {...} JSON object from possibly-prose/fenced text.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function toAction(raw: unknown): AgentAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const content = typeof r.content === "string" ? r.content : "";
  if (r.tool === "append_memory") {
    return content ? { tool: "append_memory", content } : null;
  }
  const path = typeof r.path === "string" ? r.path.trim() : "";
  if (!path) return null;
  if (r.tool === "create_note") {
    return content ? { tool: "create_note", path, content } : null;
  }
  if (r.tool === "edit_note") {
    const mode = r.mode === "replace" ? "replace" : "append";
    return content ? { tool: "edit_note", path, mode, content } : null;
  }
  return null;
}

/** Parses an agent reply into vault-write actions. null = no parseable actions object. */
export function parseActions(reply: string): AgentAction[] | null {
  const json = extractJsonObject(reply);
  if (!json) return null;
  let obj: unknown;
  try { obj = JSON.parse(json); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const actions = (obj as Record<string, unknown>).actions;
  if (!Array.isArray(actions)) return null;
  return actions.map(toAction).filter((a): a is AgentAction => a !== null);
}
