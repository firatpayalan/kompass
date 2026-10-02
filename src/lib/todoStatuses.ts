import type { PersonLabelColor } from "./personLabels";

export const BUILTIN_TODO_STATUSES: ReadonlyArray<{
  name: string;
  color: PersonLabelColor;
  countsAsComplete: boolean;
  sortOrder: number;
}> = [
  { name: "açık", color: "sky", countsAsComplete: false, sortOrder: 0 },
  { name: "devam", color: "amber", countsAsComplete: false, sortOrder: 1 },
  { name: "tamamlandı", color: "lime", countsAsComplete: true, sortOrder: 2 },
  {
    name: "tamamlanamadı",
    color: "rose",
    countsAsComplete: false,
    sortOrder: 3,
  },
];
