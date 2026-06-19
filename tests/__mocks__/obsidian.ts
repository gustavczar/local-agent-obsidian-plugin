export class ItemView {}
export class Plugin {}
export class PluginSettingTab {}
export class Modal {}
export class FuzzySuggestModal<T> {}
export class Notice { constructor(public message: string) {} }
export class TFile { constructor(public path = "") {} }
export function parseYaml(_s: string): any { return {}; }

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
