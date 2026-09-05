import type { NoteTag } from "../lib/types";

type NoteTagBadgesProps = {
  tags: NoteTag[];
};

export default function NoteTagBadges({ tags }: NoteTagBadgesProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="note-list__tags">
      {tags.map((tag) => (
        <span
          className={`person-label-badge person-label--${tag.color}`}
          key={tag.id}
        >
          #{tag.name}
        </span>
      ))}
    </div>
  );
}
