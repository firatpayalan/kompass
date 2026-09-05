export interface AsyncDb {
  execute(sql: string, bindValues?: unknown[]): Promise<void>;
  select<T>(sql: string, bindValues?: unknown[]): Promise<T[]>;
  withTransaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T>;
}

/**
 * Splits a schema file into single statements. `execute` binds one prepared
 * statement per call, so trigger bodies must survive as one chunk even though
 * they contain their own semicolons.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = "";
  let insideTriggerBody = false;

  for (const rawLine of sql.split("\n")) {
    const line = rawLine.replace(/--.*$/, "").trimEnd();
    if (!line.trim()) {
      continue;
    }

    buffer += `${line}\n`;

    if (insideTriggerBody) {
      if (/^END\s*;$/i.test(line.trim())) {
        insideTriggerBody = false;
        statements.push(buffer.trim());
        buffer = "";
      }
      continue;
    }

    if (/\bBEGIN$/i.test(line.trim())) {
      insideTriggerBody = true;
      continue;
    }

    if (line.trim().endsWith(";")) {
      statements.push(buffer.trim());
      buffer = "";
    }
  }

  if (buffer.trim()) {
    statements.push(buffer.trim());
  }

  return statements;
}

export async function applySchema(db: AsyncDb, sql: string): Promise<void> {
  for (const statement of splitSqlStatements(sql)) {
    await db.execute(statement);
  }
}
