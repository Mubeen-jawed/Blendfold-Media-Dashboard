import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { selectAccounts } from "@/lib/access";
import { resolveRange } from "@/lib/dates";
import { mapLimit, meta } from "@/lib/meta";
import type { Metrics } from "@/lib/meta/types";
import { derive, sumMetrics } from "@/lib/metrics";
import { loadPortfolio } from "@/lib/portfolio";
import { objectiveLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  if (v == null) return "";
  const s = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);
  // Neutralise spreadsheet formula injection from names that start with = + - @
  const safe = /^[=+\-@]/.test(s) && typeof v !== "number" ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

const METRIC_HEADER = ["Amount spent", "Impressions", "Link clicks", "Link CTR %", "CPC", "CPM", "Purchases", "Purchase value", "ROAS", "Cost per purchase", "Leads", "Cost per lead"];

function metricCells(m: Metrics | null) {
  if (!m) return METRIC_HEADER.map(() => null);
  return [m.spend, m.impressions, m.linkClicks, derive.ctr(m), derive.cpc(m), derive.cpm(m), m.purchases, m.purchaseValue, derive.roas(m), derive.cpa(m), m.leads, derive.cpl(m)];
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const q = Object.fromEntries(req.nextUrl.searchParams);
  const range = resolveRange(q);
  const { selected } = await selectAccounts(user, { account: q.account, client: q.client });
  const type = q.type ?? "accounts";
  let csv = "";

  if (type === "accounts" || type === "report") {
    const p = await loadPortfolio(selected, range);
    if (q.breakdown === "client" && user.role !== "CLIENT") {
      const clients = [...new Map(p.rows.map((r) => [r.ref.clientId, r.ref.clientName])).entries()];
      csv = toCsv(
        ["Client", "Ad accounts", ...METRIC_HEADER],
        [
          ...clients.map(([id, name]) => {
            const rows = p.rows.filter((r) => r.ref.clientId === id);
            return [name, rows.length, ...metricCells(sumMetrics(rows.map((r) => r.current)))];
          }),
          ["Portfolio total", p.rows.length, ...metricCells(p.current)],
        ],
      );
    } else {
      csv = toCsv(
        ["Ad account", "Account ID", "Client", "Status", "Currency", ...METRIC_HEADER],
        [
          ...p.rows.map((r) => [r.ref.name, r.ref.metaId, r.ref.clientName, r.error ? "ERROR" : r.info?.status, r.info?.currency, ...metricCells(r.current)]),
          ["Portfolio total", "", "", "", p.currency, ...metricCells(p.current)],
        ],
      );
    }
  } else if (type === "campaigns" || type === "adsets" || type === "ads") {
    const account = selected.find((a) => a.id === q.account);
    if (!account) return new Response("Choose an ad account", { status: 400 });
    if (type === "campaigns") {
      const { data } = await meta.campaigns(account.metaId, range);
      csv = toCsv(
        ["Campaign", "Campaign ID", "Delivery", "Objective", "Daily budget", "Lifetime budget", "Ad sets", ...METRIC_HEADER],
        data.map((c) => [c.name, c.id, c.status, objectiveLabel(c.objective), c.budget.daily, c.budget.lifetime, c.adsetCount, ...metricCells(c.metrics)]),
      );
    } else if (type === "adsets") {
      const { data } = await meta.adsets(account.metaId, range);
      csv = toCsv(
        ["Ad set", "Ad set ID", "Campaign", "Delivery", "Optimization", "Daily budget", "Lifetime budget", ...METRIC_HEADER],
        data.map((s) => [s.name, s.id, s.campaignName, s.status, s.optimizationGoal, s.budget.daily, s.budget.lifetime, ...metricCells(s.metrics)]),
      );
    } else {
      const { data } = await meta.ads(account.metaId, range);
      csv = toCsv(
        ["Ad", "Ad ID", "Ad set", "Campaign", "Delivery", ...METRIC_HEADER],
        data.map((a) => [a.name, a.id, a.adsetName, a.campaignName, a.status, ...metricCells(a.metrics)]),
      );
    }
  } else if (type === "leads") {
    const all = (
      await mapLimit(selected, 4, async (a) => {
        try {
          return (await meta.leads(a.metaId, range)).data.map((l) => ({ ...l, account: a.name }));
        } catch {
          return [];
        }
      })
    ).flat();
    const fieldNames = [...new Set(all.flatMap((l) => l.fields.map((f) => f.name)))];
    csv = toCsv(
      ["Submitted", "Ad account", "Campaign", "Ad", "Form ID", "Lead ID", ...fieldNames],
      all.map((l) => [l.createdTime, l.account, l.campaignName, l.adName, l.formId, l.id, ...fieldNames.map((n) => l.fields.find((f) => f.name === n)?.values.join("; "))]),
    );
  } else {
    return new Response("Unknown export type", { status: 400 });
  }

  const filename = `blendfold-${type}-${range.since}_${range.until}.csv`;
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
