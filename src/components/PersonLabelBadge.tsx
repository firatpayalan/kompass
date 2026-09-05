import type { PersonLabel } from "../lib/types";

type PersonLabelBadgeProps = {
  label: PersonLabel;
};

export default function PersonLabelBadge({ label }: PersonLabelBadgeProps) {
  return (
    <span className={`person-label-badge person-label--${label.color}`}>
      {label.name}
    </span>
  );
}
