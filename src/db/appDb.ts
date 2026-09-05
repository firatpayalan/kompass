import type {
  Initiative,
  Note,
  Person,
  Reminder,
  Topic,
} from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { connectAppDatabase } from "./connection";
import {
  createInitiative,
  deleteInitiative,
  linkNoteToInitiatives,
  listInitiatives,
  listNotesForInitiative,
  updateInitiative,
  type CreateInitiativeInput,
  type UpdateInitiativePatch,
} from "./initiativesRepo";
import {
  createNote,
  getNote,
  listActiveNotes,
  listDeletedNotes,
  listInboxNotes,
  permanentlyDeleteNote,
  restoreNote,
  softDeleteNote,
  updateNote,
  type CreateNoteInput,
} from "./notesRepo";
import {
  createPerson,
  deletePerson,
  findPersonByName,
  linkNoteToPeople,
  listNotesForPerson,
  listPeople,
  type CreatePersonInput,
} from "./peopleRepo";
import {
  advanceOrCompleteReminder,
  createReminder,
  listDueRemindersForBugun,
  markReminderDone,
  type CreateReminderInput,
} from "./remindersRepo";
import { searchNotes, type SearchNotesOptions } from "./searchRepo";
import {
  createTopic,
  listTopicsWithNotesForPerson,
  type CreateTopicInput,
  type TopicWithNotes,
} from "./topicsRepo";

/** Every repo function from tasks 6–9, bound to one live connection. */
export type AppDb = {
  createNote(input: CreateNoteInput): Promise<Note>;
  updateNote(id: number, body: string): Promise<Note>;
  getNote(id: number): Promise<Note | null>;
  listActiveNotes(): Promise<Note[]>;
  listInboxNotes(): Promise<Note[]>;
  listDeletedNotes(): Promise<Note[]>;
  softDeleteNote(id: number, nowIso: string): Promise<void>;
  restoreNote(id: number): Promise<void>;
  permanentlyDeleteNote(id: number): Promise<void>;
  linkNoteToPeople(noteId: number, personIds: number[]): Promise<void>;
  linkNoteToInitiatives(noteId: number, initiativeIds: number[]): Promise<void>;

  createPerson(input: CreatePersonInput): Promise<Person>;
  listPeople(): Promise<Person[]>;
  findPersonByName(name: string): Promise<Person | null>;
  deletePerson(id: number): Promise<void>;
  listNotesForPerson(personId: number): Promise<Note[]>;

  createTopic(input: CreateTopicInput): Promise<Topic>;
  listTopicsWithNotesForPerson(personId: number): Promise<{
    topics: TopicWithNotes[];
    untopicNotes: Note[];
  }>;

  createInitiative(input: CreateInitiativeInput): Promise<Initiative>;
  listInitiatives(): Promise<Initiative[]>;
  updateInitiative(
    id: number,
    patch: UpdateInitiativePatch,
  ): Promise<Initiative>;
  deleteInitiative(id: number): Promise<void>;
  listNotesForInitiative(initiativeId: number): Promise<Note[]>;

  createReminder(input: CreateReminderInput): Promise<Reminder>;
  listDueRemindersForBugun(
    now: Date,
  ): Promise<Array<Reminder & { title: string }>>;
  markReminderDone(id: number): Promise<void>;
  advanceOrCompleteReminder(reminder: Reminder, now: Date): Promise<void>;

  searchNotes(query: string, opts?: SearchNotesOptions): Promise<Note[]>;
};

export function createAppDb(db: AsyncDb): AppDb {
  return {
    createNote: (input) => createNote(db, input),
    updateNote: (id, body) => updateNote(db, id, body),
    getNote: (id) => getNote(db, id),
    listActiveNotes: () => listActiveNotes(db),
    listInboxNotes: () => listInboxNotes(db),
    listDeletedNotes: () => listDeletedNotes(db),
    softDeleteNote: (id, nowIso) => softDeleteNote(db, id, nowIso),
    restoreNote: (id) => restoreNote(db, id),
    permanentlyDeleteNote: (id) => permanentlyDeleteNote(db, id),
    linkNoteToPeople: (noteId, personIds) =>
      linkNoteToPeople(db, noteId, personIds),
    linkNoteToInitiatives: (noteId, initiativeIds) =>
      linkNoteToInitiatives(db, noteId, initiativeIds),

    createPerson: (input) => createPerson(db, input),
    listPeople: () => listPeople(db),
    findPersonByName: (name) => findPersonByName(db, name),
    deletePerson: (id) => deletePerson(db, id),
    listNotesForPerson: (personId) => listNotesForPerson(db, personId),

    createTopic: (input) => createTopic(db, input),
    listTopicsWithNotesForPerson: (personId) =>
      listTopicsWithNotesForPerson(db, personId),

    createInitiative: (input) => createInitiative(db, input),
    listInitiatives: () => listInitiatives(db),
    updateInitiative: (id, patch) => updateInitiative(db, id, patch),
    deleteInitiative: (id) => deleteInitiative(db, id),
    listNotesForInitiative: (initiativeId) =>
      listNotesForInitiative(db, initiativeId),

    createReminder: (input) => createReminder(db, input),
    listDueRemindersForBugun: (now) => listDueRemindersForBugun(db, now),
    markReminderDone: (id) => markReminderDone(db, id),
    advanceOrCompleteReminder: (reminder, now) =>
      advanceOrCompleteReminder(db, reminder, now),

    searchNotes: (query, opts) => searchNotes(db, query, opts),
  };
}

let appDb: AppDb | null = null;
let pendingInit: Promise<void> | null = null;

export function initAppDb(): Promise<void> {
  if (!pendingInit) {
    pendingInit = connectAppDatabase()
      .then((db) => {
        appDb = createAppDb(db);
      })
      .catch((error: unknown) => {
        pendingInit = null;
        throw error;
      });
  }

  return pendingInit;
}

export function getDb(): AppDb {
  if (!appDb) {
    throw new Error("Veritabanı hazır değil");
  }

  return appDb;
}
