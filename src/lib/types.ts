// src/lib/types.ts
export type InitiativeStatus = "aktif" | "beklemede" | "bitti";
export type ReminderPeriod = "once" | "daily" | "weekly" | "monthly";
export type ReminderTargetType = "note" | "initiative";

export interface Person {
  id: number;
  name: string;
  roleOrNotes: string | null;
  createdAt: string;
}

export interface Initiative {
  id: number;
  name: string;
  status: InitiativeStatus;
  blockerSummary: string | null;
  createdAt: string;
}

export interface Note {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: string[];
  personIds: number[];
  initiativeIds: number[];
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
