import type { Person } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { linkNoteToPeople, listNotesForPerson } from "./notesRepo";

type PersonRow = {
  id: number;
  name: string;
  role_or_notes: string | null;
  created_at: string;
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
  };
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
      `INSERT INTO people (name, role_or_notes, created_at)
       VALUES (?, ?, ?)
       RETURNING id, name, role_or_notes, created_at`,
      [input.name, input.roleOrNotes ?? null, input.nowIso],
    );

    return mapPerson(row);
  });
}

export async function listPeople(db: AsyncDb): Promise<Person[]> {
  const rows = await db.select<PersonRow>(
    `SELECT id, name, role_or_notes, created_at
     FROM people
     ORDER BY name COLLATE NOCASE, id`,
  );

  return rows.map(mapPerson);
}

export async function findPersonByName(
  db: AsyncDb,
  name: string,
): Promise<Person | null> {
  const [row] = await db.select<PersonRow>(
    `SELECT id, name, role_or_notes, created_at
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
