import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { getAccessibleAccounts } from "@/lib/access";
import { requireUser } from "@/lib/auth/user";
import { resolveRange } from "@/lib/dates";
import { idEnding } from "@/lib/format";
import { objectiveLabel } from "@/lib/labels";
import { mapLimit, meta } from "@/lib/meta";
import { str, type SearchParams } from "@/lib/page";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (str(sp.q) ?? "").trim().toLowerCase();
  const user = await requireUser();
  const accounts = await getAccessibleAccounts(user);
  const range = resolveRange({});

  const accountHits = q ? accounts.filter((a) => `${a.name} ${a.clientName} ${a.metaId}`.toLowerCase().includes(q)) : [];
  // Campaign search reads the cached campaign lists; capped to keep the page fast on large portfolios.
  const campaignHits = q
    ? (
        await mapLimit(accounts.slice(0, 40), 6, async (a) => {
          try {
            const { data } = await meta.campaigns(a.metaId, range);
            return data.filter((c) => c.name.toLowerCase().includes(q)).map((c) => ({ ...c, account: a }));
          } catch {
            return [];
          }
        })
      ).flat()
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description={q ? `Results for “${str(sp.q)}”` : "Search accounts and campaigns from the top bar."} />
      {q && accountHits.length === 0 && campaignHits.length === 0 && (
        <div className="card">
          <EmptyState title="No matches">Try an account name, client name, account ID, or campaign name.</EmptyState>
        </div>
      )}
      {accountHits.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 pb-3 text-[17px] font-semibold sm:px-6">Ad accounts</h2>
          <ul>
            {accountHits.map((a) => (
              <li key={a.id} className="border-t border-line">
                <Link href={`/campaigns?account=${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken sm:px-6">
                  <Avatar name={a.name} />
                  <div>
                    <div className="text-[15px] text-ink">{a.name}</div>
                    <div className="text-xs text-muted">
                      {a.clientName} · ID ending {idEnding(a.metaId)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {campaignHits.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 pb-3 text-[17px] font-semibold sm:px-6">Campaigns</h2>
          <ul>
            {campaignHits.slice(0, 50).map((c) => (
              <li key={c.id} className="border-t border-line">
                <Link href={`/campaigns?account=${c.account.id}&campaign=${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-sunken sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-ink">{c.name}</div>
                    <div className="text-xs text-muted">
                      {c.account.name} · {objectiveLabel(c.objective)}
                    </div>
                  </div>
                  <StatusPill status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
