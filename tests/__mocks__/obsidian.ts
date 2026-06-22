export class ItemView {}
export class Plugin {}
export class PluginSettingTab {}
export class Modal {}
export class FuzzySuggestModal<T> {}
export class Notice { constructor(public message: string) {} }
export class TFile { constructor(public path = "") {} }
export function parseYaml(_s: string): any { return {}; }
export function getLanguage(): string { return "en"; }

// requestUrl indirection so tests can override the implementation.
export interface RequestUrlParam {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  throw?: boolean;
}
export const obsidianMock = {
  requestUrl: async (_p: RequestUrlParam): Promise<any> => ({ status: 200, json: {}, text: "" }),
};
export function requestUrl(p: RequestUrlParam): Promise<any> { return obsidianMock.requestUrl(p); }

export interface CachedMetadata { frontmatter?: Record<string, any>; }
export interface Vault {
  getMarkdownFiles(): TFile[];
  read(f: TFile): Promise<string>;
  on(name: string, cb: (...a: any[]) => any): any;
}
export interface MetadataCache {
  getFileCache(f: TFile): CachedMetadata | null;
}
export interface App { vault: Vault; metadataCache: MetadataCache; }
export interface MetadataCacheWithLinks extends MetadataCache {
  getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null;
}
