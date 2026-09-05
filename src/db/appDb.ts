import type {
  Initiative,
  Note,
  Person,
  PersonLabel,
  Reminder,
  Topic,
  TopicTag,
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
  reorderPeople,
  updatePerson,
  type CreatePersonInput,
  type UpdatePersonPatch,
} from "./peopleRepo";
import {
  createPersonLabel,
  deletePersonLabel,
  listPersonLabels,
  updatePersonLabel,
  type CreatePersonLabelInput,
  type UpdatePersonLabelPatch,
} from "./personLabelsRepo";
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
  updateTopic,
  type CreateTopicInput,
  type TopicWithNotes,
} from "./topicsRepo";
import {
  addTagToTopic,
  deleteTopicTag,
  linkTagToTopic,
  listTopicTags,
  updateTopicTag,
  type AddTopicTagInput,
  type UpdateTopicTagPatch,
} from "./topicTagsRepo";

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
  updatePerson(id: number, patch: UpdatePersonPatch): Promise<Person>;
  listPeople(): Promise<Person[]>;
  reorderPeople(orderedIds: number[]): Promise<void>;
  findPersonByName(name: string): Promise<Person | null>;
  deletePerson(id: number): Promise<void>;
  listNotesForPerson(personId: number): Promise<Note[]>;
  listPersonLabels(): Promise<PersonLabel[]>;
  createPersonLabel(input: CreatePersonLabelInput): Promise<PersonLabel>;
  updatePersonLabel(
    id: number,
    patch: UpdatePersonLabelPatch,
  ): Promise<PersonLabel>;
  deletePersonLabel(id: number): Promise<void>;

  createTopic(input: CreateTopicInput): Promise<Topic>;
  updateTopic(id: number, title: string): Promise<Topic>;
  listTopicsWithNotesForPerson(personId: number): Promise<{
    topics: TopicWithNotes[];
    untopicNotes: Note[];
  }>;
  addTagToTopic(topicId: number, input: AddTopicTagInput): Promise<TopicTag>;
  linkTagToTopic(topicId: number, tagId: number): Promise<TopicTag>;
  listTopicTags(): Promise<TopicTag[]>;
  updateTopicTag(id: number, patch: UpdateTopicTagPatch): Promise<TopicTag>;
  deleteTopicTag(id: number): Promise<void>;

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
    updatePerson: (id, patch) => updatePerson(db, id, patch),
    listPeople: () => listPeople(db),
    reorderPeople: (orderedIds) => reorderPeople(db, orderedIds),
    findPersonByName: (name) => findPersonByName(db, name),
    deletePerson: (id) => deletePerson(db, id),
    listNotesForPerson: (personId) => listNotesForPerson(db, personId),
    listPersonLabels: () => listPersonLabels(db),
    createPersonLabel: (input) => createPersonLabel(db, input),
    updatePersonLabel: (id, patch) => updatePersonLabel(db, id, patch),
    deletePersonLabel: (id) => deletePersonLabel(db, id),

    createTopic: (input) => createTopic(db, input),
    updateTopic: (id, title) => updateTopic(db, id, title),
    listTopicsWithNotesForPerson: (personId) =>
      listTopicsWithNotesForPerson(db, personId),
    addTagToTopic: (topicId, input) => addTagToTopic(db, topicId, input),
    linkTagToTopic: (topicId, tagId) => linkTagToTopic(db, topicId, tagId),
    listTopicTags: () => listTopicTags(db),
    updateTopicTag: (id, patch) => updateTopicTag(db, id, patch),
    deleteTopicTag: (id) => deleteTopicTag(db, id),

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
