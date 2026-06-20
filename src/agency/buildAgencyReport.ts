export type ActionResult = {
  status: "created" | "edited" | "remembered" | "skipped" | "failed";
  path: string;
  mode?: "append" | "replace";
  err?: string;
};

function linktext(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/i, "");
}

/** Builds the quoted body for the inline [!agent] summary callout. */
export function buildAgencyReport(agentTitle: string, results: ActionResult[]): string {
  if (!results.length) return `> 🤖 *${agentTitle}:* Nenhuma ação executada.`;
  const done = results.filter((r) => r.status === "created" || r.status === "edited" || r.status === "remembered").length;
  const lines = [`> 🤖 *${agentTitle} — ${done} ação(ões):*`];
  for (const r of results) {
    if (r.status === "created") lines.push(`> ✅ Criou [[${linktext(r.path)}]]`);
    else if (r.status === "edited") lines.push(`> ✏️ Editou [[${linktext(r.path)}]] (${r.mode ?? "append"})`);
    else if (r.status === "remembered") lines.push(`> 🧠 Anotou na memória de [[${linktext(r.path)}]]`);
    else if (r.status === "skipped") lines.push(`> ⏭️ Pulou ${r.path}`);
    else lines.push(`> ⚠️ Falhou ${r.path}${r.err ? ` — ${r.err}` : ""}`);
  }
  return lines.join("\n");
}
