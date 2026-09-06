function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday-first: Monday = start of week containing `d`. */
function mondayOnOrBefore(d: Date): Date {
  const day = startOfLocalDay(d);
  const jsDay = day.getDay(); // 0 Sun … 6 Sat
  const offset = jsDay === 0 ? 6 : jsDay - 1;
  day.setDate(day.getDate() - offset);
  return day;
}

export function getWeekRange(anchor: Date): {
  weekStart: string;
  startIso: string;
  endIso: string;
} {
  const monday = mondayOnOrBefore(anchor);
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  return {
    weekStart: toYmd(monday),
    startIso: monday.toISOString(),
    endIso: next.toISOString(),
  };
}

export function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = parseYmd(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toYmd(d);
}

export function formatWeekLabel(weekStart: string): string {
  const start = parseYmd(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return `${start.toLocaleDateString("tr-TR", opts)} – ${end.toLocaleDateString("tr-TR", opts)}`;
}

export function rangeFromWeekStart(weekStart: string): {
  weekStart: string;
  startIso: string;
  endIso: string;
} {
  return getWeekRange(parseYmd(weekStart));
}
