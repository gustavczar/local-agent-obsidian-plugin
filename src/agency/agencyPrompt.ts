export const AGENCY_DIRECTIVE =
  '\n\n---\n## Modo Agência (ações no cofre)\n' +
  'Você pode AGIR no cofre criando ou editando notas. Responda APENAS com um JSON válido, ' +
  'sem nenhum texto fora dele, no formato:\n' +
  '{"actions":[{"tool":"create_note","path":"Pasta/Nota.md","content":"# Título\\n\\nCorpo em markdown Obsidian"},' +
  '{"tool":"edit_note","path":"Nota.md","mode":"append","content":"..."}]}\n' +
  'Você também pode registrar um aprendizado durável na SUA memória com ' +
  '{"tool":"append_memory","content":"o que aprendeu, em uma frase"} — use para não precisar re-descobrir isso depois. ' +
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

const PROV_RE = /\n+>\s*🤖\s*\[\[[^\]]+\]\][^\n]*\s*$/;

/** Removes a trailing provenance footer so re-writes keep a single footer at the bottom. */
export function stripTrailingProvenance(text: string): string {
  return text.replace(PROV_RE, "");
}

const MEMORY_HEAD_RE = /^#{1,6}\s*(?:🧠\s*)?Mem[óo]ria\b.*$/im;
const CONEXOES_HEAD_RE = /^#{1,6}\s*(?:🔗\s*)?(?:Conex(?:ões|oes)|Connections)\b.*$/im;

/**
 * Inserts a learning bullet into the agent's own note under a `## 🧠 Memória` section.
 * Creates the section BEFORE `## Conexões` (so parseAgent keeps it in the system prompt),
 * or appends it at the end if there is no Conexões section.
 */
export function addToMemory(body: string, entry: string): string {
  const bullet = `- ${entry}`;
  const mem = body.match(MEMORY_HEAD_RE);
  if (mem && mem.index != null) {
    const at = mem.index + mem[0].length;
    return body.slice(0, at) + "\n" + bullet + body.slice(at);
  }
  const section = `## 🧠 Memória\n${bullet}\n`;
  const con = body.match(CONEXOES_HEAD_RE);
  if (con && con.index != null) {
    return body.slice(0, con.index) + section + "\n" + body.slice(con.index);
  }
  return body.replace(/\s+$/, "") + "\n\n" + section;
}
