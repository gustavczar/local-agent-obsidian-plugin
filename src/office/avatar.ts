import { Agent } from "../types";

const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function baseName(filePath: string): string {
  return (filePath.split("/").pop() ?? filePath).replace(/\.md$/i, "");
}

export function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function accentOf(a: Agent): string {
  return a.accent && a.accent.length ? a.accent : `hsl(${hashHue(a.name)} 52% 60%)`;
}

export function displayName(a: Agent): string {
  return a.title.split(/[—–:|]/)[0].trim() || a.name;
}

export function roleText(a: Agent): string {
  const parts = a.title.split(/[—–:]/);
  return parts.length > 1 ? parts.slice(1).join(" — ").trim() : "";
}

export function avatarGlyph(a: Agent): string {
  if (a.icon && a.icon.length) return a.icon;
  const m = a.title.match(EMOJI_RE);
  if (m) return m[0];
  const words = displayName(a).split(/\s+/).filter(Boolean);
  const mono = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  return mono.toUpperCase() || (a.name[0] ?? "?").toUpperCase();
}
