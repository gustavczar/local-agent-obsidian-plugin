export interface Agent {
  name: string;          // unique id, from frontmatter `name`
  title: string;         // display title, from frontmatter `title` (fallback to name)
  systemPrompt: string;  // body of the .md, minus the Conexões section
  room: string;          // derived from #agente/<categoria> tag (fallback "Geral")
  connections: string[]; // wikilink targets found in the body
  filePath: string;
  icon?: string;         // optional frontmatter `icon` (emoji/glyph) for the avatar
  accent?: string;       // optional frontmatter `color`/`accent` (any CSS color) for the avatar
}

export type PhaserAgentStatus = "idle" | "working" | "done" | "checkpoint" | "delivering";

export interface PhaserAgent {
  id: string;
  name: string;
  icon: string;
  status: PhaserAgentStatus;
  gender?: "male" | "female";
  desk: { col: number; row: number };
}

export interface SquadHandoff {
  from: string;
  to: string;
  message: string;
  completedAt: string;
}

export interface SquadState {
  squad: string;
  status: "running" | "checkpoint" | "completed";
  step: { current: number; total: number; label: string };
  agents: PhaserAgent[];
  handoff: SquadHandoff | null;
  startedAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ProviderKind = "anthropic" | "openai-compat";

export interface ProviderConfig {
  id: string;            // user-chosen id, e.g. "claude", "deepseek"
  kind: ProviderKind;
  model: string;
  apiKey: string;
  baseURL?: string;      // required for openai-compat
}

export interface ContextNote { path: string; content: string; }

export interface BuiltPrompt { system: string; messages: ChatMessage[]; }

export type AgentAction =
  | { tool: "create_note"; path: string; content: string }
  | { tool: "edit_note"; path: string; mode: "append" | "replace"; content: string }
  | { tool: "append_memory"; content: string };
