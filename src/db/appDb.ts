import type {
  Initiative,
  Note,
  NoteTag,
  Person,
  PersonLabel,
  Reminder,
  Topic,
  TopicTag,
} from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { connectAppDatabase } from "./connection";
import {
  archiveInitiative,
  createInitiative,
  deleteInitiative,
  linkNoteToInitiatives,
  listArchivedInitiatives,
  listInitiatives,
  listNotesForInitiative,
  reorderInitiatives,
  restoreInitiative,
  updateInitiative,
  type CreateInitiativeInput,
  type UpdateInitiativePatch,
} from "./initiativesRepo";
import {
  addTagToNote,
  deleteNoteTag,
  linkTagToNote,
  listNoteTags,
  updateNoteTag,
  type AddNoteTagInput,
  type UpdateNoteTagPatch,
} from "./noteTagsRepo";
import {
  getNoteImage,
  saveNoteImage,
  type SaveNoteImageInput,
} from "./noteImagesRepo";
import {
  createNote,
  getNote,
  linkNoteToTopics,
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
  archivePerson,
  createPerson,
  deletePerson,
  findPersonByName,
  linkNoteToPeople,
  listArchivedPeople,
  listNotesForPerson,
  listPeople,
  reorderPeople,
  restorePerson,
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
  listOverdueReminders,
  listUpcomingReminders,
  markReminderDone,
  type CreateReminderInput,
} from "./remindersRepo";
import { searchNotes, type SearchNotesOptions } from "./searchRepo";
import {
  createTopic,
  listTopicsWithNotesForPerson,
  listTopicsWithNotesForInitiative,
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
  linkNoteToTopics(noteId: number, topicIds: number[]): Promise<void>;

  createPerson(input: CreatePersonInput): Promise<Person>;
  updatePerson(id: number, patch: UpdatePersonPatch): Promise<Person>;
  listPeople(): Promise<Person[]>;
  listArchivedPeople(): Promise<Person[]>;
  reorderPeople(orderedIds: number[]): Promise<void>;
  findPersonByName(name: string): Promise<Person | null>;
  archivePerson(id: number, nowIso: string): Promise<void>;
  restorePerson(id: number): Promise<Person>;
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
  listTopicsWithNotesForPerson(
    personId: number,
    options?: { includeDeletedNotes?: boolean },
  ): Promise<{
    topics: TopicWithNotes[];
    untopicNotes: Note[];
  }>;
  listTopicsWithNotesForInitiative(
    initiativeId: number,
    options?: { includeDeletedNotes?: boolean },
  ): Promise<{
    topics: TopicWithNotes[];
    untopicNotes: Note[];
  }>;
  addTagToTopic(topicId: number, input: AddTopicTagInput): Promise<TopicTag>;
  linkTagToTopic(topicId: number, tagId: number): Promise<TopicTag>;
  listTopicTags(): Promise<TopicTag[]>;
  updateTopicTag(id: number, patch: UpdateTopicTagPatch): Promise<TopicTag>;
  deleteTopicTag(id: number): Promise<void>;

  addTagToNote(noteId: number, input: AddNoteTagInput): Promise<NoteTag>;
  linkTagToNote(noteId: number, tagId: number): Promise<NoteTag>;
  listNoteTags(): Promise<NoteTag[]>;
  updateNoteTag(id: number, patch: UpdateNoteTagPatch): Promise<NoteTag>;
  deleteNoteTag(id: number): Promise<void>;

  createInitiative(input: CreateInitiativeInput): Promise<Initiative>;
  listInitiatives(): Promise<Initiative[]>;
  listArchivedInitiatives(): Promise<Initiative[]>;
  reorderInitiatives(orderedIds: number[]): Promise<void>;
  archiveInitiative(id: number, nowIso: string): Promise<void>;
  restoreInitiative(id: number): Promise<Initiative>;
  updateInitiative(
    id: number,
    patch: UpdateInitiativePatch,
  ): Promise<Initiative>;
  deleteInitiative(id: number): Promise<void>;
  listNotesForInitiative(
    initiativeId: number,
    options?: { includeDeleted?: boolean },
  ): Promise<Note[]>;

  createReminder(input: CreateReminderInput): Promise<Reminder>;
  listDueRemindersForBugun(
    now: Date,
  ): Promise<Array<Reminder & { title: string }>>;
  listOverdueReminders(
    now: Date,
  ): Promise<Array<Reminder & { title: string }>>;
  listUpcomingReminders(
    now: Date,
  ): Promise<Array<Reminder & { title: string }>>;
  markReminderDone(id: number): Promise<void>;
  advanceOrCompleteReminder(reminder: Reminder, now: Date): Promise<void>;

  searchNotes(query: string, opts?: SearchNotesOptions): Promise<Note[]>;

  saveNoteImage(input: SaveNoteImageInput): Promise<void>;
  getNoteImage(
    id: string,
  ): Promise<{ mime: string; bytesBase64: string } | null>;
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
    linkNoteToTopics: (noteId, topicIds) =>
      linkNoteToTopics(db, noteId, topicIds),

    createPerson: (input) => createPerson(db, input),
    updatePerson: (id, patch) => updatePerson(db, id, patch),
    listPeople: () => listPeople(db),
    listArchivedPeople: () => listArchivedPeople(db),
    reorderPeople: (orderedIds) => reorderPeople(db, orderedIds),
    findPersonByName: (name) => findPersonByName(db, name),
    archivePerson: (id, nowIso) => archivePerson(db, id, nowIso),
    restorePerson: (id) => restorePerson(db, id),
    deletePerson: (id) => deletePerson(db, id),
    listNotesForPerson: (personId) => listNotesForPerson(db, personId),
    listPersonLabels: () => listPersonLabels(db),
    createPersonLabel: (input) => createPersonLabel(db, input),
    updatePersonLabel: (id, patch) => updatePersonLabel(db, id, patch),
    deletePersonLabel: (id) => deletePersonLabel(db, id),

    createTopic: (input) => createTopic(db, input),
    updateTopic: (id, title) => updateTopic(db, id, title),
    listTopicsWithNotesForPerson: (personId, options) =>
      listTopicsWithNotesForPerson(db, personId, options),
    listTopicsWithNotesForInitiative: (initiativeId, options) =>
      listTopicsWithNotesForInitiative(db, initiativeId, options),
    addTagToTopic: (topicId, input) => addTagToTopic(db, topicId, input),
    linkTagToTopic: (topicId, tagId) => linkTagToTopic(db, topicId, tagId),
    listTopicTags: () => listTopicTags(db),
    updateTopicTag: (id, patch) => updateTopicTag(db, id, patch),
    deleteTopicTag: (id) => deleteTopicTag(db, id),

    addTagToNote: (noteId, input) => addTagToNote(db, noteId, input),
    linkTagToNote: (noteId, tagId) => linkTagToNote(db, noteId, tagId),
    listNoteTags: () => listNoteTags(db),
    updateNoteTag: (id, patch) => updateNoteTag(db, id, patch),
    deleteNoteTag: (id) => deleteNoteTag(db, id),

    createInitiative: (input) => createInitiative(db, input),
    listInitiatives: () => listInitiatives(db),
    listArchivedInitiatives: () => listArchivedInitiatives(db),
    reorderInitiatives: (orderedIds) => reorderInitiatives(db, orderedIds),
    archiveInitiative: (id, nowIso) => archiveInitiative(db, id, nowIso),
    restoreInitiative: (id) => restoreInitiative(db, id),
    updateInitiative: (id, patch) => updateInitiative(db, id, patch),
    deleteInitiative: (id) => deleteInitiative(db, id),
    listNotesForInitiative: (initiativeId, options) =>
      listNotesForInitiative(db, initiativeId, options),

    createReminder: (input) => createReminder(db, input),
    listDueRemindersForBugun: (now) => listDueRemindersForBugun(db, now),
    listOverdueReminders: (now) => listOverdueReminders(db, now),
    listUpcomingReminders: (now) => listUpcomingReminders(db, now),
    markReminderDone: (id) => markReminderDone(db, id),
    advanceOrCompleteReminder: (reminder, now) =>
      advanceOrCompleteReminder(db, reminder, now),

    searchNotes: (query, opts) => searchNotes(db, query, opts),

    saveNoteImage: (input) => saveNoteImage(db, input),
    getNoteImage: (id) => getNoteImage(db, id),
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
