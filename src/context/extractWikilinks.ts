const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

/** Extracts wikilink targets ([[Note]], [[Note#heading]], [[Note|alias]]) from free text, de-duped. */
export function extractWikilinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) out.push(m[1].trim());
  return [...new Set(out)];
}
