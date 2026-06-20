import { ProviderConfig } from "../types";

export interface PersistedData {
  agentsFolder: string;
  conversationsFolder: string;
  contextFolders: string[];
  positions: Record<string, { x: number; y: number }>;
  providers: ProviderConfig[];
  activeProviderId: string;
}

export const DEFAULT_SETTINGS: PersistedData = {
  agentsFolder: "06. Sistema/SUB-AGENTS",
  conversationsFolder: "Conversas Local Agent",
  contextFolders: [],
  positions: {},
  providers: [],
  activeProviderId: "",
};

export function withDefaults(raw: Partial<PersistedData> | null): PersistedData {
  if (!raw) return { ...DEFAULT_SETTINGS };
  return {
    agentsFolder: raw.agentsFolder ?? DEFAULT_SETTINGS.agentsFolder,
    conversationsFolder: raw.conversationsFolder ?? DEFAULT_SETTINGS.conversationsFolder,
    contextFolders: raw.contextFolders ?? [],
    positions: raw.positions ?? {},
    providers: raw.providers ?? DEFAULT_SETTINGS.providers,
    activeProviderId: raw.activeProviderId ?? DEFAULT_SETTINGS.activeProviderId,
  };
}
