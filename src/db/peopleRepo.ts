import type { Person, PersonLabel } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { linkNoteToPeople, listNotesForPerson } from "./notesRepo";
import { getPersonLabel } from "./personLabelsRepo";

type PersonRow = {
  id: number;
  name: string;
  role_or_notes: string | null;
  created_at: string;
  sort_order: number;
  label_id: number | null;
  label_name: string | null;
  label_color: string | null;
  label_created_at: string | null;
};

export type CreatePersonInput = {
  name: string;
  roleOrNotes?: string | null;
  labelId?: number | null;
  nowIso: string;
};

export type UpdatePersonPatch = {
  labelId?: number | null;
};

function mapLabelFromRow(row: PersonRow): PersonLabel | null {
  if (
    row.label_id == null ||
    row.label_name == null ||
    row.label_color == null ||
    row.label_created_at == null
  ) {
    return null;
  }
  return {
    id: row.label_id,
    name: row.label_name,
    color: row.label_color,
    createdAt: row.label_created_at,
  };
}

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    roleOrNotes: row.role_or_notes,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
    label: mapLabelFromRow(row),
  };
}

const PERSON_SELECT = `
  SELECT
    people.id,
    people.name,
    people.role_or_notes,
    people.created_at,
    people.sort_order,
    people.label_id,
    person_labels.name AS label_name,
    person_labels.color AS label_color,
    person_labels.created_at AS label_created_at
  FROM people
  LEFT JOIN person_labels ON person_labels.id = people.label_id
`;

/** Adds sort_order for DBs created before the column existed. */
export async function ensurePeopleSortOrder(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string }>("PRAGMA table_info(people)");
  if (columns.some((column) => column.name === "sort_order")) {
    return;
  }

  await db.execute(
    "ALTER TABLE people ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
  );

  const rows = await db.select<{ id: number }>(
    `SELECT id FROM people ORDER BY name COLLATE NOCASE, id`,
  );
  for (let index = 0; index < rows.length; index += 1) {
    await db.execute("UPDATE people SET sort_order = ? WHERE id = ?", [
      index,
      rows[index].id,
    ]);
  }
}

export async function createPerson(
  db: AsyncDb,
  input: CreatePersonInput,
): Promise<Person> {
  return db.withTransaction(async (tx) => {
    if (await findPersonByName(tx, input.name)) {
      throw new Error("Bu isimde kayıt var");
    }

    if (input.labelId != null) {
      const label = await getPersonLabel(tx, input.labelId);
      if (!label) {
        throw new Error("Etiket bulunamadı");
      }
    }

    const [row] = await tx.select<PersonRow>(
      `INSERT INTO people (name, role_or_notes, created_at, sort_order, label_id)
       VALUES (
         ?,
         ?,
         ?,
         COALESCE((SELECT MIN(sort_order) FROM people), 0) - 1,
         ?
       )
       RETURNING id, name, role_or_notes, created_at, sort_order, label_id`,
      [
        input.name,
        input.roleOrNotes ?? null,
        input.nowIso,
        input.labelId ?? null,
      ],
    );

    const [joined] = await tx.select<PersonRow>(
      `${PERSON_SELECT} WHERE people.id = ?`,
      [row.id],
    );
    return mapPerson(joined);
  });
}

export async function updatePerson(
  db: AsyncDb,
  id: number,
  patch: UpdatePersonPatch,
): Promise<Person> {
  if (!("labelId" in patch)) {
    const person = await getPerson(db, id);
    if (!person) {
      throw new Error("Kayıt bulunamadı");
    }
    return person;
  }

  if (patch.labelId != null) {
    const label = await getPersonLabel(db, patch.labelId);
    if (!label) {
      throw new Error("Etiket bulunamadı");
    }
  }

  await db.execute("UPDATE people SET label_id = ? WHERE id = ?", [
    patch.labelId ?? null,
    id,
  ]);

  const person = await getPerson(db, id);
  if (!person) {
    throw new Error("Kayıt bulunamadı");
  }
  return person;
}

export async function getPerson(
  db: AsyncDb,
  id: number,
): Promise<Person | null> {
  const [row] = await db.select<PersonRow>(
    `${PERSON_SELECT} WHERE people.id = ?`,
    [id],
  );
  return row ? mapPerson(row) : null;
}

export async function listPeople(db: AsyncDb): Promise<Person[]> {
  const rows = await db.select<PersonRow>(
    `${PERSON_SELECT}
     ORDER BY people.sort_order ASC, people.id ASC`,
  );

  return rows.map(mapPerson);
}

export async function reorderPeople(
  db: AsyncDb,
  orderedIds: number[],
): Promise<void> {
  await db.withTransaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx.execute("UPDATE people SET sort_order = ? WHERE id = ?", [
        index,
        orderedIds[index],
      ]);
    }
  });
}

export async function findPersonByName(
  db: AsyncDb,
  name: string,
): Promise<Person | null> {
  const [row] = await db.select<PersonRow>(
    `${PERSON_SELECT}
     WHERE people.name = ? COLLATE NOCASE`,
    [name],
  );

  return row ? mapPerson(row) : null;
}

export async function deletePerson(db: AsyncDb, id: number): Promise<void> {
  await db.withTransaction(async (tx) => {
    await tx.execute("DELETE FROM note_people WHERE person_id = ?", [id]);
    await tx.execute("DELETE FROM people WHERE id = ?", [id]);
  });
}

export { linkNoteToPeople, listNotesForPerson };
