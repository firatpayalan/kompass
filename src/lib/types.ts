// src/lib/types.ts
export type InitiativeStatus = "aktif" | "beklemede" | "bitti";
export type ReminderPeriod = "once" | "daily" | "weekly" | "monthly";
export type ReminderTargetType = "note" | "initiative";

export interface PersonLabel {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface Person {
  id: number;
  name: string;
  roleOrNotes: string | null;
  createdAt: string;
  sortOrder: number;
  label: PersonLabel | null;
  archivedAt: string | null;
}

export interface Initiative {
  id: number;
  name: string;
  status: InitiativeStatus;
  blockerSummary: string | null;
  createdAt: string;
  lastActivityAt: string;
  sortOrder: number;
  archivedAt: string | null;
  tags: InitiativeTag[];
}

export interface NoteTag {
  id: number;
  name: string;
  color: string;
}

export interface Note {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: NoteTag[];
  personIds: number[];
  initiativeIds: number[];
  topicIds: number[];
  nextReminderDueAt: string | null;
}

export interface Topic {
  id: number;
  personId: number | null;
  initiativeId: number | null;
  title: string;
  createdAt: string;
}

export interface TopicTag {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface InitiativeTag {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface Reminder {
  id: number;
  targetType: ReminderTargetType;
  targetId: number;
  dueAt: string;
  period: ReminderPeriod;
  done: boolean;
  createdAt: string;
}
