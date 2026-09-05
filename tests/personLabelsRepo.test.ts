import { describe, expect, it } from "vitest";

import {
  createPersonLabel,
  listPersonLabels,
  updatePersonLabel,
} from "../src/db/personLabelsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("personLabelsRepo", () => {
  it("seeds Lider, Çalışan, and Pair", async () => {
    const db = openTestAsyncDb();
    const labels = await listPersonLabels(db);
    expect(labels.map((label) => label.name).sort()).toEqual([
      "Lider",
      "Pair",
      "Çalışan",
    ].sort());
    db.close();
  });

  it("creates a custom label with a palette color", async () => {
    const db = openTestAsyncDb();
    const label = await createPersonLabel(db, {
      name: "Mentor",
      color: "rose",
      nowIso: "2026-09-05T12:00:00.000Z",
    });
    expect(label).toEqual({
      id: expect.any(Number),
      name: "Mentor",
      color: "rose",
      createdAt: "2026-09-05T12:00:00.000Z",
    });
    db.close();
  });

  it("renames and recolors an existing label", async () => {
    const db = openTestAsyncDb();
    const [lider] = (await listPersonLabels(db)).filter(
      (label) => label.name === "Lider",
    );
    const renamed = await updatePersonLabel(db, lider.id, {
      name: "Yönetici",
      color: "indigo",
    });
    expect(renamed).toEqual(
      expect.objectContaining({
        id: lider.id,
        name: "Yönetici",
        color: "indigo",
      }),
    );
    db.close();
  });

  it("rejects renaming to a duplicate label name", async () => {
    const db = openTestAsyncDb();
    const labels = await listPersonLabels(db);
    const lider = labels.find((label) => label.name === "Lider")!;
    await expect(
      updatePersonLabel(db, lider.id, { name: "Pair" }),
    ).rejects.toThrow("Bu isimde etiket var");
    db.close();
  });
});
