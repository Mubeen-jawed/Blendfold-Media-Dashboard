import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import { CompactAlerts } from "@/components/alerts-panel";
import { EntityExplorer, type EntityRow } from "@/components/entity-explorer";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { idEnding, money, multiple, num } from "@/lib/format";
import { budgetLabel, humanize, objectiveLabel } from "@/lib/labels";
import { adsManagerUrl, errorMessage, meta } from "@/lib/meta";
import type { Metrics } from "@/lib/meta/types";
import { costPerResult, derive, RESULT_LABEL, resolveResultMode, resultCount, sumMetrics, type ResultMode } from "@/lib/metrics";
import { pageContext, shellAlerts, str, type SearchParams } from "@/lib/page";

export const metadata: Metadata = { title: "Campaigns" };

function perf(m: Metrics | null, mode: ResultMode) {
  if (!m) return { spend: null, results: null, metric: null, linkClicks: null };
  return {
    spend: m.spend,
    results: resultCount(m, mode),
    metric: mode === "leads" ? derive.cpl(m) : derive.roas(m),
    linkClicks: m.linkClicks,
  };
}

export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const { params, range, all, selected, sp } = await pageContext(searchParams);
  const tab = (["adsets", "ads"].includes(str(sp.tab) ?? "") ? str(sp.tab) : "campaigns") as "campaigns" | "adsets" | "ads";
  const account = selected.find((a) => a.id === params.account) ?? selected[0];

  const header = (
    <PageHeader
      title="Campaigns"
      description="Review delivery, budgets, and attributed results. Move from campaign performance to the details that matter."
      actions={
        account && (
          <>
            <a href={`/api/export?type=${tab}&account=${account.id}&since=${range.since}&until=${range.until}`} className="btn h-11 px-4">
              <Download className="size-[18px]" strokeWidth={1.7} /> Export table
            </a>
            <a href={adsManagerUrl(account.metaId)} target="_blank" rel="noreferrer" className="btn-primary h-11">
              <ExternalLink className="size-[18px]" strokeWidth={1.8} /> Open Ads Manager
            </a>
          </>
        )
      }
    />
  );

  if (!account) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card">
          <EmptyState title="No ad accounts available">Campaigns appear here once an ad account is assigned to you.</EmptyState>
        </div>
      </div>
    );
  }

  let error: string | null = null;
  let data: Awaited<ReturnType<typeof load>> | null = null;
  async function load() {
    const [info, totals, campaigns, adsets, ads] = await Promise.all([
      meta.account(account.metaId),
      meta.totals(account.metaId, range),
      meta.campaigns(account.metaId, range),
      tab === "adsets" ? meta.adsets(account.metaId, range) : null,
      tab === "ads" ? meta.ads(account.metaId, range) : null,
    ]);
    return { info, totals, campaigns, adsets, ads };
  }
  try {
    data = await load();
  } catch (e) {
    error = errorMessage(e);
  }

  const { alerts } = await shellAlerts(all);
  const elsewhere = alerts.filter((a) => a.accountId !== account.id);

  if (!data) {
    return (
      <div className="space-y-6">
        {header}
        <FilterBar accounts={all} accountId={account.id} clientId={params.client} range={range} allowAll={false} result={params.result} />
        <div className="card">
          <EmptyState title="Couldn't load this account from Meta">{error}</EmptyState>
        </div>
      </div>
    );
  }

  const { info, totals, campaigns } = data;
  const currency = info.data.currency;
  const mode = resolveResultMode(params.result, totals.data);
  const L = RESULT_LABEL[mode];
  const camps = [...campaigns.data].sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0));
  const activeCount = camps.filter((c) => c.status === "ACTIVE").length;
  const pausedCount = camps.filter((c) => c.status.includes("PAUSED")).length;
  const selectedCampaignId = str(sp.campaign);
  const selectedCampaign = camps.find((c) => c.id === selectedCampaignId);
  // The detail card falls back to the top campaign by spend so it is never empty.
  const featured = selectedCampaign ?? camps.find((c) => c.metrics);
  const adsetFilter = str(sp.adset);

  let rows: EntityRow[] = [];
  let totalMetrics: Metrics = totals.data;
  if (tab === "campaigns") {
    rows = camps.map((c) => {
      const [budgetMain, budgetSub] = budgetLabel(c.budget, currency, "Campaign", c.adsetBudgets);
      return {
        id: c.id,
        name: c.name,
        sub: `ID ending ${idEnding(c.id)} · ${c.adsetCount} ad set${c.adsetCount === 1 ? "" : "s"}${c.metrics ? "" : " · No delivery in period"}`,
        status: c.status,
        category: objectiveLabel(c.objective),
        budgetMain,
        budgetSub,
        ...perf(c.metrics, mode),
      };
    });
  } else if (tab === "adsets") {
    const list = (data.adsets?.data ?? []).filter((s) => !selectedCampaignId || s.campaignId === selectedCampaignId);
    totalMetrics = sumMetrics(list.map((s) => s.metrics).filter((m): m is Metrics => !!m));
    rows = list
      .sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0))
      .map((s) => {
        const [budgetMain, budgetSub] = budgetLabel(s.budget, currency, "Ad set");
        return {
          id: s.id,
          name: s.name,
          sub: s.campaignName,
          status: s.status,
          category: humanize(s.optimizationGoal),
          budgetMain,
          budgetSub,
          ...perf(s.metrics, mode),
        };
      });
  } else {
    const list = (data.ads?.data ?? []).filter((a) => (!selectedCampaignId || a.campaignId === selectedCampaignId) && (!adsetFilter || a.adsetId === adsetFilter));
    totalMetrics = sumMetrics(list.map((a) => a.metrics).filter((m): m is Metrics => !!m));
    rows = list
      .sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0))
      .map((a) => ({
        id: a.id,
        name: a.name,
        sub: a.campaignName,
        status: a.status,
        category: a.adsetName,
        budgetMain: a.title ?? "",
        budgetSub: "",
        thumbnail: a.thumbnail,
        note: a.reviewFeedback,
        ...perf(a.metrics, mode),
      }));
  }

  const summary = [
    { label: "Amount spent", value: money(totals.data.spend, currency, 0) },
    { label: `Attributed ${L.many.toLowerCase()}`, value: num(resultCount(totals.data, mode)) },
    mode === "leads"
      ? { label: L.cost, value: money(costPerResult(totals.data, mode), currency, 2) }
      : { label: "Purchase ROAS", value: multiple(derive.roas(totals.data)) },
    { label: "Link clicks", value: num(totals.data.linkClicks) },
  ];

  return (
    <div className="space-y-6 lg:space-y-7">
      {header}
      <FilterBar
        accounts={all}
        accountId={account.id}
        clientId={params.client}
        range={range}
        allowAll={false}
        result={params.result}
        note={`${currency} · Account currency`}
        fetchedAt={Math.min(info.fetchedAt, campaigns.fetchedAt)}
      />

      <section className="card flex flex-col gap-5 p-5 sm:px-6 lg:flex-row lg:items-center">
        <div className="min-w-[200px] lg:w-[260px]">
          <div className="text-[15px] font-semibold text-ink">{account.name}</div>
          <div className="mt-1 text-[13px] text-muted">
            {camps.length} campaigns · {activeCount} active · {pausedCount} paused
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-5 md:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="truncate text-[13px] text-muted">{s.label}</div>
              <div className="tabular mt-1 truncate text-[26px] font-semibold text-ink">{s.value}</div>
            </div>
          ))}
        </div>
        <div>
          <StatusPill status={info.data.status} />
        </div>
      </section>

      <EntityExplorer
        tab={tab}
        counts={{ campaigns: camps.length, adsets: data.adsets?.data.length, ads: data.ads?.data.length }}
        rows={rows}
        mode={mode}
        currency={currency}
        selectedCampaign={selectedCampaignId}
        campaignFilterName={selectedCampaign?.name}
        initialDelivery={str(sp.delivery)}
        adsManagerHref={adsManagerUrl(account.metaId)}
        total={{
          label: `${account.name} total`,
          note: `${rows.length} ${tab === "adsets" ? "ad sets" : tab}`,
          spend: totalMetrics.spend,
          results: resultCount(totalMetrics, mode),
          metric: mode === "leads" ? derive.cpl(totalMetrics) : derive.roas(totalMetrics),
          linkClicks: totalMetrics.linkClicks,
        }}
        footer={
          <span>
            Showing {tab} in this account · {all.length} account{all.length === 1 ? "" : "s"} in your portfolio
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_580px]">
        {featured ? (
          <section className="card h-fit p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-semibold text-ink">{featured.name}</h2>
                <p className="mt-1 text-[13px] text-muted">{selectedCampaign ? "Selected campaign" : "Top campaign by spend"} · {account.name}</p>
              </div>
              <StatusPill status={featured.status} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-5 border-b border-line pb-5 md:grid-cols-4">
              {(() => {
                const m = featured.metrics;
                const items =
                  mode === "leads"
                    ? [
                        { label: "Amount spent", value: money(m?.spend, currency, 0) },
                        { label: L.cost, value: money(m ? costPerResult(m, mode) : null, currency, 2) },
                        { label: L.many, value: num(m?.leads) },
                        { label: "Link CTR", value: m && derive.ctr(m) != null ? `${derive.ctr(m)!.toFixed(2)}%` : "—" },
                      ]
                    : [
                        { label: "Attributed purchase value", value: money(m?.purchaseValue, currency, 0) },
                        { label: "Cost per purchase", value: money(m ? derive.cpa(m) : null, currency, 2) },
                        { label: "Purchases", value: num(m?.purchases) },
                        { label: "Purchase ROAS", value: multiple(m ? derive.roas(m) : null) },
                      ];
                return items.map((s) => (
                  <div key={s.label} className="min-w-0">
                    <div className="truncate text-[13px] text-muted">{s.label}</div>
                    <div className="tabular mt-1 truncate text-[26px] font-semibold text-ink">{s.value}</div>
                  </div>
                ));
              })()}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink">{budgetLabel(featured.budget, currency, "Campaign", featured.adsetBudgets).join(" · ")}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {featured.adsetCount} ad sets · {objectiveLabel(featured.objective)} objective
                </div>
              </div>
              <Link href={`/campaigns?account=${account.id}&tab=adsets&campaign=${featured.id}`} className="btn">
                <ArrowRight className="size-4" /> Review ad sets
              </Link>
            </div>
          </section>
        ) : (
          <section className="card flex h-fit items-center justify-center p-8 text-center text-sm text-muted">
            No campaigns delivered in this period.
          </section>
        )}
        <CompactAlerts alerts={elsewhere} title="Elsewhere in your portfolio" subtitle="Outside the selected account filter" linkLabel="All alerts →" />
      </div>
    </div>
  );
}
