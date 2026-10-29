import type { Metadata } from "next";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { LeadsTable, type LeadItem } from "@/components/leads-table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { money, num } from "@/lib/format";
import { errorMessage, mapLimit, meta } from "@/lib/meta";
import { derive, sumMetrics } from "@/lib/metrics";
import { pageContext, type SearchParams } from "@/lib/page";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const { params, range, all, selected, accountId } = await pageContext(searchParams);

  const results = await mapLimit(selected, 4, async (a) => {
    try {
      const [leads, totals, info] = await Promise.all([meta.leads(a.metaId, range), meta.totals(a.metaId, range), meta.account(a.metaId)]);
      return {
        leads: leads.data.map((l): LeadItem => ({ ...l, accountName: a.name })),
        totals: totals.data,
        currency: info.data.currency,
        fetchedAt: leads.fetchedAt,
        error: null,
      };
    } catch (e) {
      return { leads: [] as LeadItem[], totals: null, currency: null, fetchedAt: Date.now(), error: `${a.name}: ${errorMessage(e)}` };
    }
  });
  const leads = results.flatMap((r) => r.leads).sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  const totals = sumMetrics(results.map((r) => r.totals).filter((t) => t != null));
  const currency = results.find((r) => r.currency)?.currency ?? "USD";
  const errors = results.map((r) => r.error).filter(Boolean);
  const fetchedAt = results.length ? Math.min(...results.map((r) => r.fetchedAt)) : undefined;
  const qs = new URLSearchParams({ type: "leads", since: range.since, until: range.until, ...(accountId ? { account: accountId } : {}), ...(params.client ? { client: params.client } : {}) });

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Leads"
        description="Every lead form submission from your Meta lead ads, with the campaign and ad that generated it."
        actions={
          <a href={`/api/export?${qs}`} className="btn-primary h-11">
            <Download className="size-[18px]" strokeWidth={1.8} /> Export leads
          </a>
        }
      />
      <FilterBar accounts={all} accountId={accountId} clientId={params.client} range={range} showResult={false} fetchedAt={fetchedAt} />

      {errors.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
          Some accounts couldn&apos;t return leads (the token needs the <code>leads_retrieval</code> permission and page access): {errors.join(" · ")}
        </div>
      )}

      {selected.length === 0 ? (
        <div className="card">
          <EmptyState title="No ad accounts available" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">
            <StatCard label="Leads reported" value={num(totals.leads)} note="Attributed leads from Insights" />
            <StatCard label="Form submissions" value={num(leads.length)} note="Retrieved from lead forms" />
            <StatCard label="Cost per lead" value={money(derive.cpl(totals), currency, 2)} note="Spend ÷ attributed leads" />
            <StatCard label="Amount spent" value={money(totals.spend, currency, 0)} note={`Across ${selected.length} account${selected.length === 1 ? "" : "s"}`} />
          </div>
          <LeadsTable leads={leads} />
          <p className="text-xs text-muted">
            Insights lead counts can differ from form submissions: attribution windows, pixel leads, and deleted forms are counted differently.
          </p>
        </>
      )}
    </div>
  );
}
