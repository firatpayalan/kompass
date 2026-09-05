export const PERSON_LABEL_COLORS = [
  "sky",
  "teal",
  "amber",
  "rose",
  "slate",
  "lime",
  "orange",
  "indigo",
] as const;

export type PersonLabelColor = (typeof PERSON_LABEL_COLORS)[number];

export const BUILTIN_PERSON_LABELS: ReadonlyArray<{
  name: string;
  color: PersonLabelColor;
}> = [
  { name: "Lider", color: "sky" },
  { name: "Çalışan", color: "teal" },
  { name: "Pair", color: "amber" },
];

export function isPersonLabelColor(value: string): value is PersonLabelColor {
  return (PERSON_LABEL_COLORS as readonly string[]).includes(value);
}
