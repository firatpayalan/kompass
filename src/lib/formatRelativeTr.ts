const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTr(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);

  if (diffMs < MINUTE_MS) return "az önce";

  const minutes = Math.floor(diffMs / MINUTE_MS);
  if (minutes < 60) {
    return minutes === 1 ? "1 dakika önce" : `${minutes} dakika önce`;
  }

  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours < 24) {
    return hours === 1 ? "1 saat önce" : `${hours} saat önce`;
  }

  const days = Math.floor(diffMs / DAY_MS);
  if (days < 7) {
    return days === 1 ? "1 gün önce" : `${days} gün önce`;
  }

  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
