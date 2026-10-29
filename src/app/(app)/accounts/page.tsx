import type { Metadata } from "next";
import { Check, Download, ExternalLink, Info, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AccountsTable } from "@/components/accounts-table";
import { CompactAlerts } from "@/components/alerts-panel";
import { ShareBar } from "@/components/charts";
import { FilterBar } from "@/components/filter-bar";
import { Avatar, DetailRow, EmptyState, PageHeader, Pill, StatCard, StatusPill } from "@/components/ui";
import { computeAlerts } from "@/lib/alerts";
import { formatRange } from "@/lib/dates";
import { idEnding, money } from "@/lib/format";
import { adsManagerUrl } from "@/lib/meta";
import { resolveResultMode } from "@/lib/metrics";
import { pageContext, str, type SearchParams } from "@/lib/page";
import { loadPortfolio } from "@/lib/portfolio";
import { statusCounts, toTableRow, totalRow } from "@/lib/rows";

export const metadata: Metadata = { title: "Ad accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, params, range, all, selected, accountId, sp } = await pageContext(searchParams);
  const portfolio = await loadPortfolio(selected, range);
  const mode = resolveResultMode(params.result, portfolio.current);
  const alerts = computeAlerts(portfolio.rows, range);
  const status = statusCounts(portfolio);
  const connected = portfolio.rows.filter((r) => !r.error).length;
  const disabledNames = portfolio.rows.filter((r) => r.info && r.info.status !== "ACTIVE").map((r) => r.ref.name);
  const attentionAccounts = new Set(alerts.map((a) => a.accountId)).size;

  const selectedId = str(sp.selected) ?? portfolio.rows[0]?.ref.id;
  const detail = portfolio.rows.find((r) => r.ref.id === selectedId);
  const totalSpend = portfolio.current.spend || 1;
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Ad accounts"
        description="Understand account status, connections, and compare performance across your portfolio."
        actions={
          <>
            <a href={`/api/export?type=accounts&${exportQs}`} className="btn h-11 px-4">
              <Download className="size-[18px]" strokeWidth={1.7} /> Export accounts
            </a>
            {user.role === "ADMIN" && (
              <Link href="/admin/clients" className="btn-primary h-11">
                <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} /> Manage connections
              </Link>
            )}
          </>
        }
      />

      <FilterBar
        accounts={all}
        accountId={accountId}
        clientId={params.client}
        range={range}
        result={params.result}
        note={`${portfolio.currency} · Account currency`}
        fetchedAt={portfolio.fetchedAt}
      />

      {all.length === 0 ? (
        <div className="card">
          <EmptyState title="No ad accounts yet">Accounts appear here once they are assigned to you.</EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">
            <StatCard
              label="Connected accounts"
              value={`${connected} / ${portfolio.rows.length}`}
              note={connected === portfolio.rows.length ? "All account connections available" : `${portfolio.rows.length - connected} returned an error`}
            />
            <StatCard label="Active accounts" value={status.active} valueClassName="text-good" note="Current account status" />
            <StatCard
              label="Disabled accounts"
              value={status.disabled + status.closed}
              valueClassName={status.disabled + status.closed ? "text-bad" : undefined}
              note={disabledNames.length ? disabledNames.join(" · ") : "None"}
            />
            <StatCard
              label="Needs attention"
              value={`${attentionAccounts} account${attentionAccounts === 1 ? "" : "s"}`}
              valueClassName={attentionAccounts ? "text-warn" : undefined}
              note={`${alerts.length} alert${alerts.length === 1 ? "" : "s"} across the portfolio`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            <AccountsTable
              title="Your ad accounts"
              subtitle={`${portfolio.rows.length} accounts · Performance for ${formatRange(range)}`}
              rows={portfolio.rows.map((r) => toTableRow(r, mode))}
              mode={mode}
              variant="accounts"
              selectedId={detail?.ref.id}
              showClient={user.role !== "CLIENT" && new Set(selected.map((a) => a.clientId)).size > 1}
              total={portfolio.rows.length > 1 ? totalRow(portfolio, mode) : undefined}
              footer={
                <>
                  <span>Current account status may differ from delivery during the selected period.</span>
                  <span className="text-brand-ink">Showing all {portfolio.rows.length} accounts</span>
                </>
              }
            />

            {detail && (
              <section className="card h-fit p-5 sm:p-6">
                <div className="eyebrow">Account details</div>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar name={detail.ref.name} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium text-ink">{detail.ref.name}</div>
                    <div className="text-xs text-muted">ID ending {idEnding(detail.ref.metaId)}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-b border-line pb-5">
                  <StatusPill status={detail.info?.status ?? "OTHER"} />
                  {detail.error ? <Pill tone="bad">Connection error</Pill> : <Pill tone="brand">Connected</Pill>}
                </div>
                {detail.error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{detail.error}</p>}
                <dl className="mt-4 border-b border-line pb-4">
                  <DetailRow label="Client">{detail.ref.clientName}</DetailRow>
                  <DetailRow label="Currency">{detail.info?.currency ?? "—"}</DetailRow>
                  <DetailRow label="Time zone">{detail.info?.timezone ?? "—"}</DetailRow>
                  <DetailRow label="Business">{detail.info?.business ?? "—"}</DetailRow>
                  <DetailRow label="Spend cap">
                    {detail.info?.spendCap ? `${money(detail.info.amountSpent, detail.info.currency, 0)} of ${money(detail.info.spendCap, detail.info.currency, 0)}` : "Not set"}
                  </DetailRow>
                  <DetailRow label="Lifetime spend">{detail.info ? money(detail.info.amountSpent, detail.info.currency, 0) : "—"}</DetailRow>
                </dl>
                <div className="mt-4">
                  <div className="text-sm font-medium text-ink">Your account access</div>
                  <ul className="mt-2.5 space-y-2 text-sm text-ink-2">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4 text-good" /> View performance and Insights
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4 text-good" /> View campaigns, leads and audiences
                    </li>
                  </ul>
                </div>
                <div className="mt-5 flex gap-2.5 rounded-xl bg-sunken px-4 py-3 text-[13px] text-muted">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>Connection and account status are separate. Connected access does not guarantee ad delivery.</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link href={`/campaigns?account=${detail.ref.id}`} className="btn">
                    View campaigns
                  </Link>
                  <a href={adsManagerUrl(detail.ref.metaId)} target="_blank" rel="noreferrer" className="btn-primary">
                    <ExternalLink className="size-[18px]" /> Open in Ads Manager
                  </a>
                </div>
              </section>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[17px] font-semibold text-ink">Where spend is concentrated</h2>
                  <p className="mt-1 text-[13px] text-muted">Share of portfolio spend · {formatRange(range)}</p>
                </div>
                <span className="text-[13px] text-muted">{money(portfolio.current.spend, portfolio.currency, 0)} total</span>
              </div>
              <div className="mt-5">
                <ShareBar items={portfolio.rows.map((r) => ({ label: r.ref.name, value: r.current.spend }))} />
              </div>
              <dl className="mt-5 grid grid-cols-1 gap-x-10 gap-y-2.5 sm:grid-cols-2">
                {portfolio.rows.slice(0, 10).map((r) => (
                  <div key={r.ref.id} className="flex justify-between gap-3 text-sm">
                    <dt className="truncate text-ink-2">{r.ref.name}</dt>
                    <dd className="tabular font-medium text-ink">{((r.current.spend / totalSpend) * 100).toFixed(1)}%</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-xs text-muted">App-calculated shares are rounded; no portfolio budget or pacing target is applied.</p>
            </section>
            <CompactAlerts
              alerts={alerts}
              title="Account attention"
              subtitle={`${alerts.length} alert${alerts.length === 1 ? "" : "s"} · ${attentionAccounts} account${attentionAccounts === 1 ? "" : "s"}`}
            />
          </div>
          <p className="text-right text-xs text-muted">Historical conversions remain subject to attribution and reporting delays.</p>
        </>
      )}
    </div>
  );
}
