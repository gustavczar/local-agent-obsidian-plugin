import { Turn } from "./buildBrainstormPrompt";

function pad(n: number): string { return String(n).padStart(2, "0"); }

/** Assembles the result note: frontmatter + full transcript + facilitator synthesis + links. */
export function buildBrainstormNote(
  topic: string,
  turns: Turn[],
  synthesis: string,
  participants: string[],
  date: Date,
): string {
  const dt = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = dt.slice(0, 10);
  const parts = participants.map((p) => `[[${p}]]`).join(" · ");
  const convo = turns.map((t) => `**[[${t.agent}]]:** ${t.text}`).join("\n\n");
  return [
    "---",
    `created: ${dt}`,
    `updated: ${dt}`,
    "status: '🌱 semente'",
    "tipo: '📝 nota'",
    "tags:",
    '  - "#tipo/log"',
    '  - "#status/semente"',
    "---",
    "",
    `# 🧠 Brainstorm: ${topic}`,
    "",
    `> Participantes: ${parts}`,
    "",
    "## Conversa",
    "",
    convo || "(sem conversa)",
    "",
    "## Síntese",
    "",
    synthesis.trim() || "(sem síntese)",
    "",
    "## Conexões",
    `- [[${day}]]`,
    "",
  ].join("\n");
}
