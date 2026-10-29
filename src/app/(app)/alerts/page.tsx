import type { Metadata } from "next";
import { AlertIcon } from "@/components/alerts-panel";
import { FilterBar } from "@/components/filter-bar";
import { ArrowLink, EmptyState, PageHeader, Pill } from "@/components/ui";
import { computeAlerts } from "@/lib/alerts";
import { pageContext, type SearchParams } from "@/lib/page";
import { loadPortfolio } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage({ searchParams }: { searchParams: SearchParams }) {
  const { params, range, all, selected, accountId } = await pageContext(searchParams);
  const portfolio = await loadPortfolio(selected, range);
  const alerts = computeAlerts(portfolio.rows, range);
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Alerts"
        description="Account status, disapproved ads, spend caps, and app-calculated changes versus the previous period."
      />
      <FilterBar accounts={all} accountId={accountId} clientId={params.client} range={range} showResult={false} fetchedAt={portfolio.fetchedAt} />

      {alerts.length === 0 ? (
        <div className="card">
          <EmptyState title="All clear">No alerts for the selected accounts and period.</EmptyState>
        </div>
      ) : (
        [
          { title: "Critical", list: critical },
          { title: "Warnings", list: warnings },
        ]
          .filter((g) => g.list.length)
          .map((g) => (
            <section key={g.title} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
                <h2 className="text-[17px] font-semibold text-ink">{g.title}</h2>
                <Pill tone={g.title === "Critical" ? "bad" : "warn"} dot={false}>
                  {g.list.length}
                </Pill>
              </div>
              <ul>
                {g.list.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                    <AlertIcon alert={a} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium text-ink">
                        {a.title} <span className="font-normal text-muted">· {a.accountName}</span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-2">{a.message}</p>
                    </div>
                    <ArrowLink href={a.href}>{a.actionLabel}</ArrowLink>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
      <p className="text-xs text-muted">
        Alerts are calculated from Meta data each time it is fetched. Email and Slack notifications can be layered on top of these same rules.
      </p>
    </div>
  );
}
