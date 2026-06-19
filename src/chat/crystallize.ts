import { Agent, ChatMessage } from "../types";

function pad(n: number): string { return String(n).padStart(2, "0"); }
function iso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function isoMin(d: Date): string { return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

export function buildConversationNote(agent: Agent, messages: ChatMessage[], when: Date): string {
  const day = iso(when);
  const transcript = messages
    .map((m) => (m.role === "user" ? `**Você:** ${m.content}` : `**${agent.title}:** ${m.content}`))
    .join("\n\n");

  return `---
created: ${isoMin(when)}
updated: ${isoMin(when)}
status: '🌱 semente'
tipo: '📄 log'
tags:
  - "#tipo/log"
  - "#status/semente"
---

# 💬 Conversa com ${agent.title} — ${day}

> Cristalizada do Local Agent Office.
> Agente: [[${agent.name}]] · Daily: [[${day}]]

---

${transcript}
`;
}
