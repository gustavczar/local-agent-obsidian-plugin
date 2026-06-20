export interface SquadStepResult { agent: string; instruction: string; output: string; }

function pad(n: number): string { return String(n).padStart(2, "0"); }
function isoMin(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Renders a completed squad run into a markdown note (frontmatter + each step's approved output). */
export function buildSquadRun(squadName: string, results: SquadStepResult[], when: Date): string {
  const day = isoMin(when).slice(0, 10);
  const sections = results
    .map((r, i) => `## ${i + 1}. ${r.agent}\n*${r.instruction}*\n\n${r.output.trim()}`)
    .join("\n\n---\n\n");

  return `---
created: ${isoMin(when)}
updated: ${isoMin(when)}
status: '🌱 semente'
tipo: '📄 log'
tags:
  - "#tipo/log"
  - "#status/semente"
---

# 🤝 Squad: ${squadName} — ${day}

> Resultado de um pipeline de agentes (cada passo aprovado por você).

---

${sections}
`;
}
