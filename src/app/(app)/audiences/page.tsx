import type { Metadata } from "next";
import { Bookmark, CircleUser, ExternalLink, Info, Users } from "lucide-react";
import { AudiencesExplorer, type AudienceItem } from "@/components/audiences-explorer";
import { FilterBar } from "@/components/filter-bar";
import { RefreshButton } from "@/components/filters";
import { EmptyState, PageHeader } from "@/components/ui";
import { errorMessage, mapLimit, meta } from "@/lib/meta";
import { pageContext, type SearchParams } from "@/lib/page";

export const metadata: Metadata = { title: "Audiences" };

export default async function AudiencesPage({ searchParams }: { searchParams: SearchParams }) {
  const { params, all, selected, accountId } = await pageContext(searchParams);

  const results = await mapLimit(selected, 6, async (a) => {
    try {
      const r = await meta.audiences(a.metaId);
      return { items: r.data.map((x): AudienceItem => ({ ...x, accountName: a.name, accountMetaId: a.metaId })), fetchedAt: r.fetchedAt, error: null };
    } catch (e) {
      return { items: [] as AudienceItem[], fetchedAt: Date.now(), error: `${a.name}: ${errorMessage(e)}` };
    }
  });
  const items = results.flatMap((r) => r.items);
  const errors = results.map((r) => r.error).filter(Boolean);
  const custom = items.filter((i) => i.kind === "custom");
  const saved = items.filter((i) => i.kind === "saved");
  const bySource = [...custom.reduce((m, a) => m.set(a.source, (m.get(a.source) ?? 0) + 1), new Map<string, number>()).entries()];
  const fetchedAt = results.length ? Math.min(...results.map((r) => r.fetchedAt)) : undefined;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Audiences"
        description="Find accessible custom and saved audiences, review their source, and understand what is available."
        actions={
          <a href="https://adsmanager.facebook.com/adsmanager/audiences" target="_blank" rel="noreferrer" className="btn-primary h-11">
            <ExternalLink className="size-[18px]" strokeWidth={1.8} /> Manage audiences
          </a>
        }
      />
      <FilterBar
        accounts={all}
        accountId={accountId}
        clientId={params.client}
        showResult={false}
        note="Accessible audiences only"
        fetchedAt={fetchedAt}
        right={<RefreshButton label="Refresh audiences" />}
      />

      {errors.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
          Some accounts couldn&apos;t be read: {errors.join(" · ")}
        </div>
      )}

      {selected.length === 0 ? (
        <div className="card">
          <EmptyState title="No ad accounts available" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
            {[
              { icon: CircleUser, value: items.length, label: "Accessible audiences", note: `Across ${selected.length} connected account${selected.length === 1 ? "" : "s"}` },
              { icon: Users, value: custom.length, label: "Custom audiences", note: "Website, customer list, and engagement sources" },
              { icon: Bookmark, value: saved.length, label: "Saved audiences", note: "Reusable targeting definitions, not member lists" },
            ].map((s) => (
              <div key={s.label} className="card flex items-start gap-4 p-5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-brand-soft text-brand-ink">
                  <s.icon className="size-5" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="tabular text-[26px] font-semibold text-ink">{s.value}</span>
                    <span className="text-[15px] font-medium text-ink">{s.label}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">{s.note}</div>
                </div>
              </div>
            ))}
          </div>

          <AudiencesExplorer items={items} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="card p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold text-ink">Sources in this collection</h2>
              <p className="mt-1 text-[13px] text-muted">{custom.length} custom audiences · Grouped by source</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {bySource.length === 0 && <p className="text-sm text-muted">No custom audiences.</p>}
                {bySource.map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between rounded-xl border border-line bg-sunken px-4 py-3">
                    <span className="text-[13px] text-ink-2">{source}</span>
                    <span className="tabular text-[17px] font-semibold text-ink">{count}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-ink">Reading audience availability</h2>
                <Info className="size-5 text-muted" strokeWidth={1.6} />
              </div>
              <p className="mt-3 text-[13px] text-ink-2">
                Ready and Populating reflect custom audience processing. Accessible means a saved targeting definition can be read with current permissions.
              </p>
              <p className="mt-3 text-xs text-muted">Unavailable size does not mean zero people. Some estimates are withheld or not provided for this view.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
