export const AGENCY_DIRECTIVE =
  '\n\n---\n## Modo Agência (ações no cofre)\n' +
  'Você pode AGIR no cofre criando ou editando notas. Responda APENAS com um JSON válido, ' +
  'sem nenhum texto fora dele, no formato:\n' +
  '{"actions":[{"tool":"create_note","path":"Pasta/Nota.md","content":"# Título\\n\\nCorpo em markdown Obsidian"},' +
  '{"tool":"edit_note","path":"Nota.md","mode":"append","content":"..."}]}\n' +
  'Regras: use markdown Obsidian válido (e [[links]] quando fizer sentido); ' +
  'no máximo 5 ações; se nenhuma ação for necessária, responda {"actions":[]}.';

const INVALID = /[\\:*?"<>|]/g;

/** Cleans an agent-proposed path: drops traversal, replaces invalid chars, ensures .md. */
export function sanitizePath(raw: string): string {
  const parts = raw.split("/").map((s) => s.trim()).filter((s) => s && s !== "." && s !== "..");
  let path = parts.join("/").replace(INVALID, "-");
  if (!path) path = "nota";
  if (!/\.md$/i.test(path)) path += ".md";
  return path;
}

/** Full target-path precedence: explicit folder in path → agencyFolder → conversationsFolder → root. */
export function resolveTargetPath(rawPath: string, agencyFolder: string, conversationsFolder: string): string {
  const clean = sanitizePath(rawPath);
  if (clean.includes("/")) return clean; // agent gave an explicit folder
  const folder = (agencyFolder || conversationsFolder || "").replace(/\/+$/, "").trim();
  return folder ? `${folder}/${clean}` : clean;
}

function pad(n: number): string { return String(n).padStart(2, "0"); }

/** Provenance trail appended to any note the agent writes. */
export function provenanceFooter(agentLinktext: string, date: Date): string {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `\n\n> 🤖 [[${agentLinktext}]] · ${d}`;
}
