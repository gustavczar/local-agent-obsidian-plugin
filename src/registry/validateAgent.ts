import { parseAgent } from "./parseAgent";

export type IssueLevel = "error" | "warn";
export interface AgentIssue {
  level: IssueLevel;
  code: string;
  message: string;
}

const NAME_WS_RE = /\s/;
const AGENT_TAG_RE = /#?agente\/[a-z0-9\-_]+/i;

/**
 * Lints an agent .md (frontmatter + body) and returns high-signal issues.
 * `error` = the agent will not behave as intended; `warn` = works but suboptimal.
 * Reuses parseAgent so the resolved name/room/connections never drift from runtime.
 */
export function validateAgent(
  frontmatter: Record<string, unknown>,
  body: string,
  filePath: string,
): AgentIssue[] {
  const agent = parseAgent(frontmatter, body, filePath);
  const issues: AgentIssue[] = [];
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  if (!agent.systemPrompt) {
    issues.push({
      level: "error",
      code: "no_instructions",
      message: "Corpo vazio: o agente não tem instruções (system prompt).",
    });
  }

  if (!str(frontmatter.name).trim()) {
    issues.push({
      level: "warn",
      code: "no_name",
      message: "Sem `name` no frontmatter; usando o nome do arquivo como id.",
    });
  }

  if (NAME_WS_RE.test(agent.name)) {
    issues.push({
      level: "warn",
      code: "name_has_space",
      message: "O id do agente tem espaço; @menções podem falhar. Use um `name` sem espaços.",
    });
  }

  if (!str(frontmatter.title).trim()) {
    issues.push({
      level: "warn",
      code: "no_title",
      message: "Sem `title`; usando o id como nome de exibição.",
    });
  }

  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
  if (!tags.some((t) => AGENT_TAG_RE.test(t))) {
    issues.push({
      level: "warn",
      code: "no_agent_tag",
      message: 'Sem tag `#agente/<categoria>`; o agente cai na sala "Geral".',
    });
  }

  if (agent.connections.length === 0) {
    issues.push({
      level: "warn",
      code: "no_connections",
      message: "Sem conexões [[...]]; ligue o agente a um MOC ou nota relacionada.",
    });
  }

  return issues;
}

export function isValidAgent(issues: AgentIssue[]): boolean {
  return !issues.some((i) => i.level === "error");
}
