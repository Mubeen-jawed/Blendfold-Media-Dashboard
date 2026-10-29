import "server-only";
import type { AccountRef } from "@/lib/access";
import { eachDay, previousRange, type DateRange } from "@/lib/dates";
import { EMPTY_METRICS, addMetrics, sumMetrics } from "@/lib/metrics";
import { errorMessage, mapLimit, meta } from "@/lib/meta";
import type { AccountInfo, DailyPoint, Metrics } from "@/lib/meta/types";

export type AccountSummary = {
  ref: AccountRef;
  info: AccountInfo | null;
  current: Metrics;
  previous: Metrics;
  daily: DailyPoint[];
  prevDaily: DailyPoint[];
  disapproved: number;
  error: string | null;
  fetchedAt: number;
};

export type Portfolio = {
  range: DateRange;
  prevRange: DateRange;
  rows: AccountSummary[];
  current: Metrics;
  previous: Metrics;
  daily: DailyPoint[];
  prevDaily: DailyPoint[];
  currency: string;
  mixedCurrency: boolean;
  fetchedAt: number;
};

async function loadAccount(ref: AccountRef, range: DateRange, prev: DateRange): Promise<AccountSummary> {
  try {
    const [info, cur, prv, daily, prevDaily, disapproved] = await Promise.all([
      meta.account(ref.metaId),
      meta.totals(ref.metaId, range),
      meta.totals(ref.metaId, prev),
      meta.daily(ref.metaId, range),
      meta.daily(ref.metaId, prev),
      meta.disapprovedAds(ref.metaId).catch(() => ({ data: 0, fetchedAt: Date.now() })),
    ]);
    return {
      ref,
      info: info.data,
      current: cur.data,
      previous: prv.data,
      daily: daily.data,
      prevDaily: prevDaily.data,
      disapproved: disapproved.data,
      error: null,
      fetchedAt: Math.min(info.fetchedAt, cur.fetchedAt, daily.fetchedAt),
    };
  } catch (e) {
    return {
      ref,
      info: null,
      current: { ...EMPTY_METRICS },
      previous: { ...EMPTY_METRICS },
      daily: [],
      prevDaily: [],
      disapproved: 0,
      error: errorMessage(e),
      fetchedAt: Date.now(),
    };
  }
}

function alignDaily(days: string[], series: DailyPoint[][]): DailyPoint[] {
  const byDate = new Map<string, Metrics>();
  for (const list of series) {
    for (const p of list) byDate.set(p.date, addMetrics(byDate.get(p.date) ?? { ...EMPTY_METRICS }, p));
  }
  return days.map((date) => ({ date, ...(byDate.get(date) ?? { ...EMPTY_METRICS }) }));
}

export async function loadPortfolio(accounts: AccountRef[], range: DateRange): Promise<Portfolio> {
  const prevRange = previousRange(range);
  const rows = await mapLimit(accounts, 6, (a) => loadAccount(a, range, prevRange));
  rows.sort((a, b) => b.current.spend - a.current.spend);

  const currencies = rows.map((r) => r.info?.currency).filter((c): c is string => !!c);
  const counts = new Map<string, number>();
  for (const c of currencies) counts.set(c, (counts.get(c) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  return {
    range,
    prevRange,
    rows,
    current: sumMetrics(rows.map((r) => r.current)),
    previous: sumMetrics(rows.map((r) => r.previous)),
    daily: alignDaily(eachDay(range), rows.map((r) => r.daily)),
    prevDaily: alignDaily(eachDay(prevRange), rows.map((r) => r.prevDaily)),
    currency,
    mixedCurrency: counts.size > 1,
    fetchedAt: rows.length ? Math.min(...rows.map((r) => r.fetchedAt)) : Date.now(),
  };
}

/** Groups daily points into buckets ("daily" | "weekly" | "monthly"). */
export function bucket(daily: DailyPoint[], interval: "daily" | "weekly" | "monthly") {
  if (interval === "daily") return daily.map((d) => ({ label: d.date, start: d.date, end: d.date, metrics: d as Metrics }));
  const groups: { label: string; start: string; end: string; metrics: Metrics }[] = [];
  daily.forEach((d, i) => {
    const key = interval === "weekly" ? Math.floor(i / 7) : d.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.label === String(key)) {
      last.end = d.date;
      last.metrics = addMetrics(last.metrics, d);
    } else {
      groups.push({ label: String(key), start: d.date, end: d.date, metrics: { ...d } });
    }
  });
  return groups;
}
