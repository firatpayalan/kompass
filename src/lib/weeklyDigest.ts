import type { Initiative, Note, Person } from "./types";

export type DigestSection<T> = {
  entity: T;
  notes: Note[];
};

export type WeekDigest = {
  peopleSections: DigestSection<Person>[];
  initiativeSections: DigestSection<Initiative>[];
  noteCount: number;
  personCount: number;
  initiativeCount: number;
};

export function stripNoteImagesForLlm(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\(dlt-img:[^)]+\)/g, "")
    .replace(/  +/g, " ")
    .trim();
}

export function groupNotesForWeek(
  notes: Note[],
  people: Person[],
  initiatives: Initiative[],
): WeekDigest {
  const linked = notes.filter(
    (n) => n.personIds.length > 0 || n.initiativeIds.length > 0,
  );

  const peopleSections: DigestSection<Person>[] = [];
  for (const person of people) {
    const personNotes = linked.filter((n) => n.personIds.includes(person.id));
    if (personNotes.length > 0) {
      peopleSections.push({ entity: person, notes: personNotes });
    }
  }

  const initiativeSections: DigestSection<Initiative>[] = [];
  for (const initiative of initiatives) {
    const initiativeNotes = linked.filter((n) =>
      n.initiativeIds.includes(initiative.id),
    );
    if (initiativeNotes.length > 0) {
      initiativeSections.push({ entity: initiative, notes: initiativeNotes });
    }
  }

  return {
    peopleSections,
    initiativeSections,
    noteCount: linked.length,
    personCount: peopleSections.length,
    initiativeCount: initiativeSections.length,
  };
}

export type LlmNotePayloadItem = {
  createdAt: string;
  body: string;
  people: string[];
  initiatives: string[];
};

export function buildLlmNotesPayload(
  notes: Note[],
  peopleById: Map<number, Person>,
  initiativesById: Map<number, Initiative>,
): LlmNotePayloadItem[] {
  return notes
    .filter((n) => n.personIds.length > 0 || n.initiativeIds.length > 0)
    .map((n) => ({
      createdAt: n.createdAt,
      body: stripNoteImagesForLlm(n.body),
      people: n.personIds
        .map((id) => peopleById.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
      initiatives: n.initiativeIds
        .map((id) => initiativesById.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
    }));
}
