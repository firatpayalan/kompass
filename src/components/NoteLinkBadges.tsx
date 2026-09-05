import type { Initiative, Note, Person } from "../lib/types";

type NoteLinkBadgesProps = {
  note: Note;
  peopleById: Map<number, Person>;
  initiativesById: Map<number, Initiative>;
};

export default function NoteLinkBadges({
  note,
  peopleById,
  initiativesById,
}: NoteLinkBadgesProps) {
  const people = note.personIds
    .map((id) => peopleById.get(id))
    .filter((person): person is Person => Boolean(person));
  const initiatives = note.initiativeIds
    .map((id) => initiativesById.get(id))
    .filter((initiative): initiative is Initiative => Boolean(initiative));

  if (people.length === 0 && initiatives.length === 0) {
    return null;
  }

  return (
    <div aria-label="Bağlantılar" className="note-list__links">
      {people.map((person) => (
        <span className="note-list__link note-list__link--person" key={`p-${person.id}`}>
          {person.name}
        </span>
      ))}
      {initiatives.map((initiative) => (
        <span
          className="note-list__link note-list__link--initiative"
          key={`i-${initiative.id}`}
        >
          {initiative.name}
        </span>
      ))}
    </div>
  );
}
