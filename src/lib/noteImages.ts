export const MAX_NOTE_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_NOTE_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedNoteImageMime = (typeof ALLOWED_NOTE_IMAGE_MIMES)[number];

/** Matches ![görsel](dlt-img:<uuid>) */
export const NOTE_IMAGE_MARKER_RE =
  /!\[görsel\]\(dlt-img:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export function isAllowedNoteImageMime(
  mime: string,
): mime is AllowedNoteImageMime {
  return (ALLOWED_NOTE_IMAGE_MIMES as readonly string[]).includes(mime);
}

export function formatNoteImageMarker(id: string): string {
  return `![görsel](dlt-img:${id})`;
}

export function insertAtCursor(
  value: string,
  start: number,
  end: number,
  insertion: string,
): { next: string; caret: number } {
  const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
  return { next, caret: start + insertion.length };
}

export function extractNoteImageIds(body: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(NOTE_IMAGE_MARKER_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

export function splitNoteBody(
  body: string,
): Array<{ type: "text"; value: string } | { type: "image"; id: string }> {
  const parts: Array<
    { type: "text"; value: string } | { type: "image"; id: string }
  > = [];
  const re = new RegExp(NOTE_IMAGE_MARKER_RE.source, "gi");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }
    parts.push({ type: "image", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push({ type: "text", value: body.slice(lastIndex) });
  }
  return parts;
}

export function dataUrlToBase64(dataUrl: string): {
  mime: string;
  bytesBase64: string;
} | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], bytesBase64: match[2] };
}
