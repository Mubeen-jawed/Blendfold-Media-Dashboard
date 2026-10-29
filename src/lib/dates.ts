export type DateRange = { since: string; until: string };

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_28d", label: "Last 28 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
] as const;

export const DEFAULT_PRESET = "last_28d";

const DAY = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseISO(s: string) {
  return new Date(`${s}T00:00:00Z`);
}

function utcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function resolveRange(params: { range?: string; since?: string; until?: string }): DateRange & { preset: string } {
  if (params.since && params.until && ISO_RE.test(params.since) && ISO_RE.test(params.until) && params.since <= params.until) {
    return { since: params.since, until: params.until, preset: "custom" };
  }
  const today = utcToday();
  const preset = params.range ?? DEFAULT_PRESET;
  const daysBack = (n: number) => ({
    since: toISO(new Date(today.getTime() - n * DAY)),
    until: toISO(new Date(today.getTime() - DAY)),
  });
  switch (preset) {
    case "today":
      return { since: toISO(today), until: toISO(today), preset };
    case "yesterday": {
      const y = toISO(new Date(today.getTime() - DAY));
      return { since: y, until: y, preset };
    }
    case "last_7d":
      return { ...daysBack(7), preset };
    case "last_14d":
      return { ...daysBack(14), preset };
    case "last_30d":
      return { ...daysBack(30), preset };
    case "last_90d":
      return { ...daysBack(90), preset };
    case "this_month":
      return { since: toISO(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), until: toISO(today), preset };
    case "last_month": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return { since: toISO(start), until: toISO(end), preset };
    }
    default:
      return { ...daysBack(28), preset: DEFAULT_PRESET };
  }
}

export function rangeDays(r: DateRange) {
  return Math.round((parseISO(r.until).getTime() - parseISO(r.since).getTime()) / DAY) + 1;
}

/** The period of equal length immediately before `r`. */
export function previousRange(r: DateRange): DateRange {
  const len = rangeDays(r);
  const until = new Date(parseISO(r.since).getTime() - DAY);
  const since = new Date(until.getTime() - (len - 1) * DAY);
  return { since: toISO(since), until: toISO(until) };
}

export function eachDay(r: DateRange) {
  const out: string[] = [];
  const end = parseISO(r.until).getTime();
  for (let t = parseISO(r.since).getTime(); t <= end; t += DAY) out.push(toISO(new Date(t)));
  return out;
}

export function shortDate(iso: string) {
  return parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatRange(r: DateRange) {
  const a = parseISO(r.since);
  const b = parseISO(r.until);
  const tz = { timeZone: "UTC" } as const;
  const month = (d: Date) => d.toLocaleDateString("en-US", { ...tz, month: "short" });
  if (r.since === r.until) return a.toLocaleDateString("en-US", { ...tz, month: "short", day: "numeric", year: "numeric" });
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    if (a.getUTCMonth() === b.getUTCMonth()) return `${month(a)} ${a.getUTCDate()} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
    return `${month(a)} ${a.getUTCDate()} – ${month(b)} ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  }
  return `${month(a)} ${a.getUTCDate()}, ${a.getUTCFullYear()} – ${month(b)} ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
}
