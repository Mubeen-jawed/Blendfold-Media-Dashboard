import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser, ROLE_LABEL } from "@/lib/auth/user";
import { getAccessibleAccounts } from "@/lib/access";
import { prisma } from "@/lib/db";
import { fetchedLabel } from "@/lib/format";
import { isMockMode } from "@/lib/meta";
import { shellAlerts } from "@/lib/page";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [accounts, savedViews] = await Promise.all([
    getAccessibleAccounts(user),
    prisma.savedView.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, href: true } }),
  ]);
  const { alerts, fetchedAt, errors } = await shellAlerts(accounts);

  const connection = isMockMode()
    ? { ok: false, label: "Sample data mode" }
    : errors > 0
      ? { ok: false, label: `${errors} account${errors === 1 ? "" : "s"} unreachable` }
      : { ok: true, label: accounts.length ? "All accounts connected" : "No accounts assigned" };

  return (
    <Suspense>
      <AppShell
        user={{ name: user.name, email: user.email, roleLabel: ROLE_LABEL[user.role], isAdmin: user.role === "ADMIN" }}
        accountCount={accounts.length}
        alertCount={alerts.length}
        savedViews={savedViews}
        connection={{ ...connection, fetched: fetchedLabel(fetchedAt) }}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
