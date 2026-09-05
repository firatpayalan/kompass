import { useEffect, useState } from "react";
import { splitNoteBody } from "../lib/noteImages";

type GetNoteImage = (
  id: string,
) => Promise<{ mime: string; bytesBase64: string } | null>;

type NoteBodyViewProps = {
  body: string;
  getNoteImage: GetNoteImage;
  className?: string;
};

export default function NoteBodyView({
  body,
  getNoteImage,
  className,
}: NoteBodyViewProps) {
  const parts = splitNoteBody(body);
  const [sources, setSources] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const ids = parts
      .filter((part) => part.type === "image")
      .map((part) => part.id);
    void Promise.all(
      ids.map(async (id) => {
        const image = await getNoteImage(id);
        if (!image) return null;
        return [id, `data:${image.mime};base64,${image.bytesBase64}`] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      const next: Record<string, string> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setSources(next);
    });
    return () => {
      active = false;
    };
  }, [body, getNoteImage]);

  return (
    <div className={className ? `note-body-view ${className}` : "note-body-view"}>
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span className="note-body-view__text" key={`t-${index}`}>
            {part.value}
          </span>
        ) : sources[part.id] ? (
          <img
            alt="görsel"
            className="note-body-view__image"
            key={`i-${part.id}-${index}`}
            src={sources[part.id]}
          />
        ) : (
          <span className="note-body-view__missing" key={`m-${part.id}-${index}`}>
            [görsel]
          </span>
        ),
      )}
    </div>
  );
}
