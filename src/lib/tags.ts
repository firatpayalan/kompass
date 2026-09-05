// src/lib/tags.ts
export function parseHashtags(body: string): string[] {
  const matches = body.match(/#[\p{L}\p{N}_:-]+/gu) ?? [];
  const normalized = matches.map((m) => m.slice(1).toLocaleLowerCase("tr-TR"));
  return [...new Set(normalized)];
}
