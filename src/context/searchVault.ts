export interface RankItem { path: string; text: string; }
export interface RankHit { path: string; score: number; }

const STOP = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "ou", "que", "para", "por", "com", "sem",
  "um", "uma", "no", "na", "nos", "nas", "em", "ao", "se", "como", "qual", "quais", "meu", "minha",
  "the", "of", "to", "in", "is", "and", "or", "for", "with", "a", "an", "how", "what", "my",
]);

/** Lightweight relevance ranking by term overlap (no embeddings). Higher score = more query terms hit. */
export function rankNotes(query: string, items: RankItem[], limit: number): RankHit[] {
  const terms = [...new Set(
    query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2 && !STOP.has(t)),
  )];
  if (!terms.length) return [];

  const hits: RankHit[] = [];
  for (const it of items) {
    const hay = it.text.toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += 1;
    if (score > 0) hits.push({ path: it.path, score });
  }
  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return hits.slice(0, limit);
}
