const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

/** "Sen, 14 Sep 2026 • 16.30" */
export function formatDateTime(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${dateFormatter.format(d)} • ${timeFormatter.format(d).replace(":", ".")}`;
}

/** "24 Sep 2026" */
export function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}
