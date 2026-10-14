import type { ReactNode, SVGProps } from "react";

const shapes = {
  today: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18m-13 5h3" /></>,
  inbox: <><path d="m4 4-2 9v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5l-2-9H4Z" /><path d="M2 13h6l2 3h4l2-3h6" /></>,
  note: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8m-8 4h5" /></>,
  todo: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m7 12 3 3 7-7" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a20 20 0 0 0 18 0m-9 0v3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18m-12 4h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01" /></>,
  settings: <><path d="m9 3-.6 2.2-2 .9-2-.6-2 3.4 1.5 1.6v2.3l-1.5 1.6 2 3.4 2-.6 2 .9L9 21h4l.6-2.2 2-.9 2 .6 2-3.4-1.5-1.6v-2.3l1.5-1.6-2-3.4-2 .6-2-.9L13 3Z" /><circle cx="11" cy="12" r="3" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  archive: <><rect x="3" y="3" width="18" height="5" rx="1.5" /><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-10 4h6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M7 17 17 7M7 7h10v10" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>,
  tag: <><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7.5" cy="7.5" r=".5" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof shapes;

export default function Icon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{shapes[name]}</svg>;
}
