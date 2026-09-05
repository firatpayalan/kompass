import type { Person } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { linkNoteToPeople, listNotesForPerson } from "./notesRepo";

type PersonRow = {
  id: number;
  name: string;
  role_or_notes: string | null;
  created_at: string;
  sort_order: number;
};

export type CreatePersonInput = {
  name: string;
  roleOrNotes?: string | null;
  nowIso: string;
};

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    roleOrNotes: row.role_or_notes,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
  };
}

const PERSON_COLUMNS = "id, name, role_or_notes, created_at, sort_order";

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

    const [row] = await tx.select<PersonRow>(
      `INSERT INTO people (name, role_or_notes, created_at, sort_order)
       VALUES (
         ?,
         ?,
         ?,
         COALESCE((SELECT MIN(sort_order) FROM people), 0) - 1
       )
       RETURNING ${PERSON_COLUMNS}`,
      [input.name, input.roleOrNotes ?? null, input.nowIso],
    );

    return mapPerson(row);
  });
}

export async function listPeople(db: AsyncDb): Promise<Person[]> {
  const rows = await db.select<PersonRow>(
    `SELECT ${PERSON_COLUMNS}
     FROM people
     ORDER BY sort_order ASC, id ASC`,
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
    `SELECT ${PERSON_COLUMNS}
     FROM people
     WHERE name = ? COLLATE NOCASE`,
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
