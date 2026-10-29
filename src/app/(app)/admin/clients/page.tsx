import type { Metadata } from "next";
import { ClientsManager, type AdminClient } from "@/components/admin/clients-manager";
import { PageHeader, StatCard } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/user";
import { prisma } from "@/lib/db";
import { errorMessage, isMockMode, meta } from "@/lib/meta";

export const metadata: Metadata = { title: "Clients & accounts" };

export default async function ClientsPage() {
  await requireAdmin();
  const mock = isMockMode();
  const [agencies, clients, discovered] = await Promise.all([
    prisma.agency.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { clients: true, users: true } } } }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { agency: { select: { name: true } }, adAccounts: { orderBy: { name: "asc" } }, _count: { select: { users: true } } },
    }),
    mock
      ? Promise.resolve({ data: [], error: null })
      : meta
          .accessibleAccounts()
          .then((r) => ({ data: r.data, error: null }))
          .catch((e) => ({ data: [], error: errorMessage(e) })),
  ]);

  const rows: AdminClient[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    agencyId: c.agencyId,
    agencyName: c.agency?.name ?? null,
    userCount: c._count.users,
    accounts: c.adAccounts.map((a) => ({ id: a.id, metaId: a.metaId, name: a.name })),
  }));
  const accountCount = rows.reduce((s, c) => s + c.accounts.length, 0);

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Clients & accounts"
        description="Organise clients under agencies and link the Meta ad accounts each client can see."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-5">
        <StatCard label="Agencies" value={agencies.length} note="Groups of clients" />
        <StatCard label="Clients" value={clients.length} note="Each sees only their own accounts" />
        <StatCard label="Linked ad accounts" value={accountCount} note={mock ? "Sample data mode" : `${discovered.data.length} readable by the token`} />
      </div>
      <ClientsManager
        agencies={agencies.map((a) => ({ id: a.id, name: a.name, clientCount: a._count.clients, ownerCount: a._count.users }))}
        clients={rows}
        discoverable={discovered.data.map((d) => ({ id: d.id, name: d.name, business: d.business, status: d.status }))}
        discoverError={discovered.error}
        mock={mock}
      />
    </div>
  );
}
