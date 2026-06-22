import { Agent } from "../types";

const CONEXOES_RE = /\n#{1,6}\s*(?:🔗\s*)?(?:Conex(?:ões|oes)|Connections)[\s\S]*$/i;
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function deriveRoom(tags: unknown): string {
  const list = Array.isArray(tags) ? tags.map(String) : [];
  for (const t of list) {
    const m = t.match(/#?agente\/([a-z0-9\-_]+)/i);
    if (m) return capitalize(m[1]);
  }
  return "Geral";
}

function baseName(filePath: string): string {
  return (filePath.split("/").pop() ?? filePath).replace(/\.md$/i, "");
}

export function parseAgent(
  frontmatter: Record<string, unknown>,
  body: string,
  filePath: string,
): Agent {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const name = str(frontmatter.name).trim() || baseName(filePath);
  const title = str(frontmatter.title).trim() || name;
  const room = deriveRoom(frontmatter.tags);

  const connections: string[] = [];
  for (const m of body.matchAll(WIKILINK_RE)) {
    connections.push(m[1].trim());
  }

  const systemPrompt = body.replace(CONEXOES_RE, "").trim();

  const iconStr = str(frontmatter.icon).trim();
  const icon = iconStr || undefined;
  const accentStr = (str(frontmatter.accent) || str(frontmatter.color)).trim();
  const accent = accentStr || undefined;

  return { name, title, systemPrompt, room, connections: [...new Set(connections)], filePath, icon, accent };
}
