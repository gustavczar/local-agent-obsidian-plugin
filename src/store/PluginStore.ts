import { ProviderConfig } from "../types";

export interface PersistedData {
  agentsFolder: string;
  conversationsFolder: string;
  contextFolders: string[];
  autoConsultVault: boolean;
  autoDelegate: boolean;
  positions: Record<string, { x: number; y: number }>;
  providers: ProviderConfig[];
  activeProviderId: string;
  agencyFolder: string;
  // Token economy
  economyMode: boolean;      // force lean context everywhere
  maxTokens: number;         // cap on response tokens (0 = provider default)
  lightProviderId: string;   // cheap/fast provider for brainstorm/squad/routing (empty = use active)
}

export const DEFAULT_SETTINGS: PersistedData = {
  agentsFolder: "06. Sistema/SUB-AGENTS",
  conversationsFolder: "Conversas Local Agent",
  contextFolders: [],
  autoConsultVault: true,
  autoDelegate: true,
  positions: {},
  providers: [],
  activeProviderId: "",
  agencyFolder: "",
  economyMode: false,
  maxTokens: 0,
  lightProviderId: "",
};

export function withDefaults(raw: Partial<PersistedData> | null): PersistedData {
  if (!raw) return { ...DEFAULT_SETTINGS };
  return {
    agentsFolder: raw.agentsFolder ?? DEFAULT_SETTINGS.agentsFolder,
    conversationsFolder: raw.conversationsFolder ?? DEFAULT_SETTINGS.conversationsFolder,
    contextFolders: raw.contextFolders ?? [],
    autoConsultVault: raw.autoConsultVault ?? DEFAULT_SETTINGS.autoConsultVault,
    autoDelegate: raw.autoDelegate ?? DEFAULT_SETTINGS.autoDelegate,
    positions: raw.positions ?? {},
    providers: raw.providers ?? DEFAULT_SETTINGS.providers,
    activeProviderId: raw.activeProviderId ?? DEFAULT_SETTINGS.activeProviderId,
    agencyFolder: raw.agencyFolder ?? DEFAULT_SETTINGS.agencyFolder,
    economyMode: raw.economyMode ?? DEFAULT_SETTINGS.economyMode,
    maxTokens: raw.maxTokens ?? DEFAULT_SETTINGS.maxTokens,
    lightProviderId: raw.lightProviderId ?? DEFAULT_SETTINGS.lightProviderId,
  };
}
