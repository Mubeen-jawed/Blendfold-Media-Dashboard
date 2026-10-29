import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, Info } from "lucide-react";
import { SpendReturnChart } from "@/components/charts";
import { FilterBar } from "@/components/filter-bar";
import { SelectMenu } from "@/components/filters";
import { Avatar, Callout, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatRange, shortDate } from "@/lib/dates";
import { money, multiple, num } from "@/lib/format";
import { costPerResult, derive, RESULT_LABEL, resolveResultMode, resultCount, sumMetrics } from "@/lib/metrics";
import type { Metrics } from "@/lib/meta/types";
import { pageContext, str, type SearchParams } from "@/lib/page";
import { bucket, loadPortfolio } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Reports" };

/** "Oct 1–7" or "Sep 29–Oct 5" */
function weekLabel(start: string, end: string) {
  if (start === end) return shortDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${shortDate(start)}–${sameMonth ? Number(end.slice(8)) : shortDate(end)}`;
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { params, range, all, selected, accountId, sp, user } = await pageContext(searchParams);
  const portfolio = await loadPortfolio(selected, range);
  const cur = portfolio.current;
  const mode = resolveResultMode(params.result, cur);
  const L = RESULT_LABEL[mode];
  const leads = mode === "leads";
  const interval = (["daily", "weekly", "monthly"].includes(str(sp.interval) ?? "") ? str(sp.interval) : "weekly") as "daily" | "weekly" | "monthly";
  const breakdown = str(sp.breakdown) === "client" && user.role !== "CLIENT" ? "client" : "account";
  const n = selected.length;
  const currency = portfolio.currency;

  const buckets = bucket(portfolio.daily, interval).map((b) => ({
    label:
      interval === "daily"
        ? shortDate(b.start)
        : interval === "monthly"
          ? new Date(`${b.start}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
          : weekLabel(b.start, b.end),
    spend: Math.round(b.metrics.spend),
    secondary: leads ? derive.cpl(b.metrics) : derive.roas(b.metrics),
  }));
  const firstSec = buckets.find((b) => b.secondary != null)?.secondary;
  const lastSec = [...buckets].reverse().find((b) => b.secondary != null)?.secondary;

  const groups: { key: string; name: string; sub: string; m: Metrics }[] =
    breakdown === "client"
      ? [...new Map(portfolio.rows.map((r) => [r.ref.clientId, r.ref.clientName])).entries()].map(([id, name]) => ({
          key: id,
          name,
          sub: `${portfolio.rows.filter((r) => r.ref.clientId === id).length} ad accounts`,
          m: sumMetrics(portfolio.rows.filter((r) => r.ref.clientId === id).map((r) => r.current)),
        }))
      : portfolio.rows.map((r) => ({ key: r.ref.id, name: r.ref.name, sub: r.info?.currency ?? currency, m: r.current }));
  groups.sort((a, b) => b.m.spend - a.m.spend);
  const totalSpend = cur.spend || 1;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
  qs.set("type", "report");
  qs.set("breakdown", breakdown);

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Reports"
        description={`Turn portfolio performance into a clear, shareable view of spend, attributed ${L.many.toLowerCase()}, and return.`}
        actions={
          <a href={`/api/export?${qs}`} className="btn-primary h-11">
            <Download className="size-[18px]" strokeWidth={1.8} /> Export report
          </a>
        }
      />
      <FilterBar
        accounts={all}
        accountId={accountId}
        clientId={params.client}
        range={range}
        result={params.result}
        note={`${currency} · Account currency`}
        fetchedAt={portfolio.fetchedAt}
      />

      {n === 0 ? (
        <div className="card">
          <EmptyState title="Nothing to report yet">Reports appear once ad accounts are assigned.</EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
            <StatCard label="Amount spent" value={money(cur.spend, currency, 0)} note={`Across ${n} ${currency} ad account${n === 1 ? "" : "s"}`} />
            {leads ? (
              <StatCard label="Link clicks" value={num(cur.linkClicks)} note={`${money(derive.cpc(cur), currency, 2)} cost per link click`} />
            ) : (
              <StatCard label="Attributed purchase value" value={money(cur.purchaseValue, currency, 0)} note="Reported conversion value" />
            )}
            <StatCard label={`Attributed ${L.many.toLowerCase()}`} value={num(resultCount(cur, mode))} note={`${L.one} actions`} />
            {leads ? (
              <StatCard label="CPM" value={money(derive.cpm(cur), currency, 2)} note="Spend per 1,000 impressions" />
            ) : (
              <StatCard label="Purchase ROAS" value={multiple(derive.roas(cur))} note="Purchase value ÷ spend" />
            )}
            <StatCard label={L.cost} value={money(costPerResult(cur, mode), currency, 2)} note={`Spend ÷ attributed ${L.many.toLowerCase()}`} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <section className="card pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6">
                <div>
                  <h2 className="text-[17px] font-semibold text-ink">Spend and {leads ? "cost per lead" : "purchase return"}</h2>
                  <p className="mt-1 text-[13px] text-muted">
                    {interval.charAt(0).toUpperCase() + interval.slice(1)} totals across {n === 1 ? selected[0].name : `all ${n} accounts`}
                  </p>
                </div>
                <Suspense>
                  <SelectMenu
                    label=""
                    param="interval"
                    value={interval}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                  />
                </Suspense>
              </div>
              <SpendReturnChart buckets={buckets} mode={mode} currency={currency} />
              {firstSec != null && lastSec != null && buckets.length > 1 && (
                <div className="px-5 pt-3 sm:px-6">
                  <Callout icon={Info}>
                    App-calculated: {interval} {leads ? "cost per lead" : "purchase ROAS"} {lastSec >= firstSec ? "rose" : "fell"} from{" "}
                    {leads ? money(firstSec, currency, 2) : multiple(firstSec)} to {leads ? money(lastSec, currency, 2) : multiple(lastSec)} during this period.
                  </Callout>
                </div>
              )}
            </section>

            <section className="card h-fit p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold text-ink">Report setup</h2>
              <p className="mt-1 border-b border-line pb-4 text-[13px] text-muted">Portfolio performance</p>
              <Suspense>
                <div className="divide-y divide-line">
                  <div className="py-3.5">
                    <div className="eyebrow">Accounts</div>
                    <div className="mt-1 text-[15px] text-ink">{accountId ? selected[0].name : `All ad accounts (${n})`}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <div className="eyebrow">Breakdown</div>
                    <SelectMenu
                      label=""
                      param="breakdown"
                      value={breakdown}
                      options={[
                        { value: "account", label: "Ad account" },
                        ...(user.role !== "CLIENT" ? [{ value: "client", label: "Client" }] : []),
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <div className="eyebrow">Time interval</div>
                    <SelectMenu
                      label=""
                      param="interval"
                      value={interval}
                      options={[
                        { value: "daily", label: "Daily" },
                        { value: "weekly", label: "Weekly" },
                        { value: "monthly", label: "Monthly" },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <div className="eyebrow">Metrics</div>
                    <SelectMenu
                      label=""
                      param="result"
                      value={params.result ?? ""}
                      options={[
                        { value: "", label: "Automatic" },
                        { value: "purchases", label: "Purchase performance" },
                        { value: "leads", label: "Lead performance" },
                      ]}
                    />
                  </div>
                </div>
              </Suspense>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <div>
                  <div className="text-sm font-medium text-ink">CSV · Current filters</div>
                  <div className="text-xs text-muted">
                    {groups.length} {breakdown === "client" ? "client" : "account"} rows + portfolio total
                  </div>
                </div>
                <a href={`/api/export?${qs}`} className="btn-primary">
                  <Download className="size-[18px]" /> Export CSV
                </a>
              </div>
              <p className="mt-4 text-xs text-muted">Export uses accessible Insights data. This is a Blendfold reporting view, not a platform-saved report.</p>
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
              <div>
                <h2 className="text-[17px] font-semibold text-ink">Performance by {breakdown === "client" ? "client" : "ad account"}</h2>
                <p className="mt-1 text-[13px] text-muted">
                  {formatRange(range)} · Attributed {L.one.toLowerCase()} metrics
                </p>
              </div>
              <a href={`/api/export?${qs}`} className="btn">
                <Download className="size-[18px]" strokeWidth={1.7} /> Download
              </a>
            </div>
            <div className="scroll-x border-t border-line">
              <table className="w-full min-w-[900px]">
                <thead className="bg-sunken">
                  <tr className="border-b border-line">
                    <th className="th">{breakdown === "client" ? "Client" : "Ad account"}</th>
                    <th className="th">Amount spent ↓</th>
                    <th className="th">{L.many}</th>
                    <th className="th">{leads ? "CTR" : "Purchase ROAS"}</th>
                    <th className="th">{L.costShort}</th>
                    <th className="th">Link clicks</th>
                    <th className="th w-[200px]">Share of spend</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const share = (g.m.spend / totalSpend) * 100;
                    const roas = derive.roas(g.m);
                    return (
                      <tr key={g.key} className="border-b border-line last:border-0">
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <Avatar name={g.name} />
                            <div>
                              <div className="text-[15px] text-ink">{g.name}</div>
                              <div className="text-xs text-muted">{g.sub}</div>
                            </div>
                          </div>
                        </td>
                        <td className="td tabular text-[15px]">{money(g.m.spend, currency, 0)}</td>
                        <td className="td tabular text-[15px]">{num(resultCount(g.m, mode))}</td>
                        <td className={`td tabular text-[15px] ${!leads && roas != null && roas < 2 ? "text-warn" : ""}`}>
                          {leads ? (derive.ctr(g.m) != null ? `${derive.ctr(g.m)!.toFixed(2)}%` : "—") : multiple(roas)}
                        </td>
                        <td className="td tabular text-[15px]">{money(costPerResult(g.m, mode), currency, 2)}</td>
                        <td className="td tabular text-[15px]">{num(g.m.linkClicks)}</td>
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sunken">
                              <div className="h-full rounded-full bg-chart-1" style={{ width: `${share}%` }} />
                            </div>
                            <span className="tabular text-xs text-muted">{share.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-sunken">
                  <tr className="border-t border-line">
                    <td className="td font-semibold">Portfolio total</td>
                    <td className="td tabular text-[15px] font-semibold">{money(cur.spend, currency, 0)}</td>
                    <td className="td tabular text-[15px] font-semibold">{num(resultCount(cur, mode))}</td>
                    <td className="td tabular text-[15px] font-semibold">{leads ? (derive.ctr(cur) != null ? `${derive.ctr(cur)!.toFixed(2)}%` : "—") : multiple(derive.roas(cur))}</td>
                    <td className="td tabular text-[15px] font-semibold">{money(costPerResult(cur, mode), currency, 2)}</td>
                    <td className="td tabular text-[15px] font-semibold">{num(cur.linkClicks)}</td>
                    <td className="td text-xs text-muted">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
