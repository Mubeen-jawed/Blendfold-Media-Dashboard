import type { Metadata } from "next";
import { UsersManager, type AdminUser } from "@/components/admin/users-manager";
import { PageHeader, StatCard } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const [users, agencies, clients] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { agency: { select: { name: true } }, client: { select: { name: true } } },
    }),
    prisma.agency.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: AdminUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    agencyId: u.agencyId,
    clientId: u.clientId,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    scope:
      u.role === "ADMIN"
        ? "All clients"
        : u.role === "AGENCY_OWNER"
          ? (u.agency ? `Agency · ${u.agency.name}` : u.client ? `Client · ${u.client.name}` : "Unassigned")
          : (u.client?.name ?? "Unassigned"),
  }));

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        title="Users"
        description="Create logins, set and reset passwords, and control which clients each person can see."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-5">
        <StatCard label="Admins" value={users.filter((u) => u.role === "ADMIN").length} note="Full portfolio access" />
        <StatCard label="Agency owners" value={users.filter((u) => u.role === "AGENCY_OWNER").length} note="See all clients in their agency" />
        <StatCard label="Client users" value={users.filter((u) => u.role === "CLIENT").length} note="See their own ad accounts" />
      </div>
      <UsersManager users={rows} agencies={agencies} clients={clients} currentUserId={admin.id} />
    </div>
  );
}
