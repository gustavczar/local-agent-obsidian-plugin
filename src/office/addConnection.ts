const HEADING_RE = /^#{1,6}\s*(?:🔗\s*)?(?:Conex(?:ões|oes)|Connections)\s*$/i;

/**
 * Inserts `- [[linktext]]` under the note's `## Conexões`/`## Connections` section
 * (creating the section if missing). No-op if the link already exists.
 */
export function addConnectionToBody(content: string, linktext: string): string {
  const link = `[[${linktext}]]`;
  if (content.includes(link)) return content;

  const lines = content.split("\n");
  const idx = lines.findIndex((l) => HEADING_RE.test(l));

  if (idx === -1) {
    const trimmed = content.replace(/\s+$/, "");
    return `${trimmed}\n\n## Conexões\n- ${link}\n`;
  }

  let j = idx + 1;
  while (j < lines.length && lines[j].trim().startsWith("-")) j++;
  lines.splice(j, 0, `- ${link}`);
  return lines.join("\n");
}
