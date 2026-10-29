import type { AccountTableRow } from "@/components/accounts-table";
import { idEnding } from "@/lib/format";
import { costPerResult, derive, resultCount, type ResultMode } from "@/lib/metrics";
import type { Metrics } from "@/lib/meta/types";
import type { AccountSummary, Portfolio } from "@/lib/portfolio";

export function toTableRow(r: AccountSummary, mode: ResultMode): AccountTableRow {
  return {
    id: r.ref.id,
    name: r.ref.name,
    ending: idEnding(r.ref.metaId),
    clientName: r.ref.clientName,
    status: r.info?.status ?? "OTHER",
    currency: r.info?.currency ?? "USD",
    spend: r.current.spend,
    roas: derive.roas(r.current),
    results: resultCount(r.current, mode),
    cost: costPerResult(r.current, mode),
    linkClicks: r.current.linkClicks,
    error: r.error,
  };
}

export function totalRow(p: Portfolio, mode: ResultMode, m: Metrics = p.current) {
  return {
    spend: m.spend,
    roas: derive.roas(m),
    results: resultCount(m, mode),
    cost: costPerResult(m, mode),
    linkClicks: m.linkClicks,
    statusNote: statusNote(p),
    currency: p.currency,
  };
}

export function statusCounts(p: Portfolio) {
  let active = 0;
  let disabled = 0;
  let closed = 0;
  let other = 0;
  for (const r of p.rows) {
    const s = r.info?.status;
    if (s === "ACTIVE") active++;
    else if (s === "DISABLED" || s === "UNSETTLED") disabled++;
    else if (s === "CLOSED") closed++;
    else other++;
  }
  return { active, disabled, closed, other };
}

function statusNote(p: Portfolio) {
  const c = statusCounts(p);
  return [`${c.active} active`, c.disabled && `${c.disabled} disabled`, c.closed && `${c.closed} closed`].filter(Boolean).join(" · ");
}
