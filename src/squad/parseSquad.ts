export interface SquadStep { agentRef: string; instruction: string; }
export interface Squad { name: string; steps: SquadStep[]; }

// "1. [[agente]]: instrução"  (também aceita ) e - e travessão como separador)
const STEP_RE = /^\s*\d+[.)]\s*\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]\s*[:：—-]\s*(.+)$/;

export function isSquadFrontmatter(fm: Record<string, any> | undefined): boolean {
  if (!fm) return false;
  if (fm.squad === true || String(fm.tipo ?? "").toLowerCase().includes("squad")) return true;
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
  return tags.some((t) => /#?squad/i.test(t));
}

/** Parses a squad note: a numbered list of `N. [[agent]]: instruction` steps. */
export function parseSquad(content: string): Squad {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const lines = body.split("\n");
  const heading = lines.find((l) => /^#\s+/.test(l));
  const name = heading ? heading.replace(/^#\s+/, "").replace(/^Squad:\s*/i, "").trim() : "Squad";

  const steps: SquadStep[] = [];
  for (const l of lines) {
    const m = l.match(STEP_RE);
    if (m) steps.push({ agentRef: m[1].trim(), instruction: m[2].trim() });
  }
  return { name, steps };
}
