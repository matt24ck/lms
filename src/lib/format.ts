/**
 * Kick-offs and deadlines are always shown in UK time. Fixing the zone keeps
 * server and client output identical (no hydration mismatch) and matches how
 * Premier League kick-off times are published.
 */
const ZONE = "Europe/London";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatDateTime(value: Date | string) {
  return dateTime.format(new Date(value));
}

export function formatTime(value: Date | string) {
  return timeOnly.format(new Date(value));
}

export function formatDay(value: Date | string) {
  return dayOnly.format(new Date(value));
}

/**
 * Deadline checks live here rather than inline in components: reading the
 * clock during render trips React's purity rule, and keeping it in one place
 * means every screen agrees on what "closed" means.
 */
export function isPast(value: Date | string) {
  return new Date(value).getTime() <= Date.now();
}

export function isFuture(value: Date | string) {
  return !isPast(value);
}

/** "in 2 days", "in 3 hours", "closed" — for deadline urgency. */
export function formatCountdown(deadline: Date | string) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "closed";

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Formats an ISO string for a datetime-local input, in UK time. */
export function toDateTimeLocalValue(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
