import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, ShieldCheck, TrendingUp, Check } from "lucide-react";
import { AccountsTable } from "@/components/accounts-table";
import { NeedsAttention } from "@/components/alerts-panel";
import { PerformanceChart } from "@/components/charts";
import { FilterBar } from "@/components/filter-bar";
import { Callout, Delta, EmptyState, KpiCard, PageHeader } from "@/components/ui";
import { computeAlerts } from "@/lib/alerts";
import { rangeDays } from "@/lib/dates";
import { change, fetchedLabel, money, multiple, num, pct } from "@/lib/format";
import { adsManagerUrl } from "@/lib/meta";
import { costPerResult, derive, RESULT_LABEL, resolveResultMode, resultCount } from "@/lib/metrics";
import { pageContext, type SearchParams } from "@/lib/page";
import { loadPortfolio } from "@/lib/portfolio";
import { statusCounts, toTableRow, totalRow } from "@/lib/rows";

export const metadata: Metadata = { title: "Portfolio overview" };

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, params, range, all, selected, accountId, sp } = await pageContext(searchParams);
  const portfolio = await loadPortfolio(selected, range);
  const { current: cur, previous: prev } = portfolio;
  const mode = resolveResultMode(params.result, cur);
  const L = RESULT_LABEL[mode];
  const alerts = computeAlerts(portfolio.rows, range);
  const days = rangeDays(range);
  const n = selected.length;
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();

  const roas = derive.roas(cur);
  const roasPrev = derive.roas(prev);
  const ctr = derive.ctr(cur);
  const ctrPrev = derive.ctr(prev);
  const insight = (() => {
    if (mode === "purchases") {
      const d = change(roas, roasPrev);
      if (d == null) return null;
      return `App-calculated: attributed purchase ROAS ${d >= 0 ? "improved" : "declined"} ${Math.abs(d).toFixed(1)}% versus the previous ${days}-day period.`;
    }
    const d = change(derive.cpl(cur), derive.cpl(prev));
    if (d == null) return null;
    return `App-calculated: cost per lead ${d <= 0 ? "improved" : "rose"} ${Math.abs(d).toFixed(1)}% versus the previous ${days}-day period.`;
  })();

  const status = statusCounts(portfolio);
  const statusTotal = Math.max(1, status.active + status.disabled + status.closed);
  const fetched = fetchedLabel(portfolio.fetchedAt);
  const single = accountId ? selected[0] : undefined;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Portfolio overview"
        description={`A clearer view of spend, ${L.many.toLowerCase()}, and account status across your media portfolio.`}
        actions={
          <>
            <a href={`/api/export?type=accounts&${exportQs}`} className="btn h-11 px-4">
              <Download className="size-[18px]" strokeWidth={1.7} /> Export report
            </a>
            <a href={adsManagerUrl(single?.metaId)} target="_blank" rel="noreferrer" className="btn-primary h-11">
              <ExternalLink className="size-[18px]" strokeWidth={1.8} /> Open Ads Manager
            </a>
          </>
        }
      />

      <FilterBar
        accounts={all}
        accountId={accountId}
        clientId={params.client}
        range={range}
        result={params.result}
        note={`${portfolio.currency} · ${portfolio.mixedCurrency ? "Mixed currencies, summed as reported" : `Aggregated across ${portfolio.currency} accounts`}`}
        fetchedAt={portfolio.fetchedAt}
        compareLabel={`vs. previous ${days}-day period`}
      />

      {all.length === 0 ? (
        <div className="card">
          <EmptyState title="No ad accounts yet">
            {user.role === "ADMIN" ? (
              <>
                Add a client and connect its Meta ad accounts in{" "}
                <Link className="link" href="/admin/clients">
                  Clients &amp; accounts
                </Link>
                .
              </>
            ) : (
              "Your Blendfold admin hasn't assigned any ad accounts to you yet."
            )}
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
            <KpiCard
              label="Amount spent"
              hint="Total spend reported by Meta for the selected period."
              value={money(cur.spend, portfolio.currency, 0)}
              delta={<Delta value={change(cur.spend, prev.spend)} />}
              footnote={`across ${n} ad account${n === 1 ? "" : "s"}`}
            />
            {mode === "purchases" ? (
              <KpiCard
                label="Purchase ROAS"
                hint="Attributed purchase value ÷ spend."
                value={multiple(roas)}
                delta={<Delta value={change(roas, roasPrev)} />}
                footnote={`${money(cur.purchaseValue, portfolio.currency, 0)} attributed purchase value`}
              />
            ) : (
              <KpiCard
                label="CPM"
                hint="Cost per 1,000 impressions."
                value={money(derive.cpm(cur), portfolio.currency, 2)}
                delta={<Delta value={change(derive.cpm(cur), derive.cpm(prev))} invert />}
                footnote={`${num(cur.impressions)} impressions`}
              />
            )}
            <KpiCard
              label={L.many}
              hint={`Attributed ${L.many.toLowerCase()} using each account's attribution setting.`}
              value={num(resultCount(cur, mode))}
              delta={<Delta value={change(resultCount(cur, mode), resultCount(prev, mode))} />}
              footnote={`attributed ${L.many.toLowerCase()}`}
            />
            <KpiCard
              label={L.cost}
              hint={`Spend ÷ attributed ${L.many.toLowerCase()}.`}
              value={money(costPerResult(cur, mode), portfolio.currency, 2)}
              delta={<Delta value={change(costPerResult(cur, mode), costPerResult(prev, mode))} invert />}
              footnote={`cost per attributed ${L.one.toLowerCase()}`}
            />
            <KpiCard
              label="Link CTR"
              hint="Link clicks ÷ impressions."
              value={pct(ctr)}
              delta={<Delta value={ctr != null && ctrPrev != null ? ctr - ctrPrev : null} suffix="pp" />}
              footnote={`${money(derive.cpc(cur), portfolio.currency, 2)} CPC · ${num(cur.linkClicks)} link clicks`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0 space-y-6">
              <section className="card pb-5">
                <PerformanceChart
                  daily={portfolio.daily}
                  prevDaily={portfolio.prevDaily}
                  mode={mode}
                  currency={portfolio.currency}
                  subtitle={`Spend and ${mode === "leads" ? "lead results" : "attributed purchase ROAS"} across ${n === 1 ? selected[0].name : `all ${n} accounts`}`}
                />
                {insight && (
                  <div className="px-5 pt-3 sm:px-6">
                    <Callout icon={TrendingUp}>{insight}</Callout>
                  </div>
                )}
              </section>

              <AccountsTable
                title="Ad accounts"
                subtitle={`${n} account${n === 1 ? "" : "s"}`}
                rows={portfolio.rows.map((r) => toTableRow(r, mode))}
                mode={mode}
                variant="overview"
                showClient={false}
                total={n > 1 ? totalRow(portfolio, mode) : undefined}
              />
            </div>

            <div className="space-y-6">
              <NeedsAttention alerts={alerts} fetched={fetched.split(" · ")[0]} />
              <section className="card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] font-semibold text-ink">Account status summary</h2>
                  <ShieldCheck className="size-5 text-muted" strokeWidth={1.6} />
                </div>
                <div className="mt-5 flex h-2 gap-1">
                  <span className="rounded-full bg-good" style={{ flex: status.active || 0.0001 }} />
                  <span className="rounded-full bg-warn/70" style={{ flex: status.disabled || 0.0001 }} />
                  <span className="rounded-full bg-bad" style={{ flex: status.closed || 0.0001 }} />
                </div>
                <div className="mt-4 grid grid-cols-3">
                  {[
                    { label: "Active", value: status.active, dot: "bg-good" },
                    { label: "Disabled", value: status.disabled, dot: "bg-warn" },
                    { label: "Closed", value: status.closed, dot: "bg-bad" },
                  ].map((s, i) => (
                    <div key={s.label} className={i === 1 ? "text-center" : i === 2 ? "text-right" : ""}>
                      <div className="tabular text-[26px] font-semibold text-ink">{s.value}</div>
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <span className={`size-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 text-xs text-muted">
                  <Check className="size-3.5" /> {Math.round((status.active / statusTotal) * 100)}% of accounts active · subject to permissions and conversion reporting.
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
