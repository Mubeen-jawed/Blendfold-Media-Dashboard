import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/user";

export type AccountRef = {
  id: string;
  metaId: string;
  name: string;
  clientId: string;
  clientName: string;
};

/** Row-level scoping: which ad accounts a user may see. */
export function accountScope(user: CurrentUser): Prisma.AdAccountWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "AGENCY_OWNER") {
    if (user.agencyId) return { client: { agencyId: user.agencyId } };
    if (user.clientId) return { clientId: user.clientId };
    return { id: "__none__" };
  }
  return user.clientId ? { clientId: user.clientId } : { id: "__none__" };
}

export const getAccessibleAccounts = cache(async (user: CurrentUser): Promise<AccountRef[]> => {
  const rows = await prisma.adAccount.findMany({
    where: accountScope(user),
    include: { client: { select: { name: true } } },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map((a) => ({ id: a.id, metaId: a.metaId, name: a.name, clientId: a.clientId, clientName: a.client.name }));
});

export const getAccessibleClients = cache(async (user: CurrentUser) => {
  const accounts = await getAccessibleAccounts(user);
  const map = new Map<string, { id: string; name: string; count: number }>();
  for (const a of accounts) {
    const c = map.get(a.clientId) ?? { id: a.clientId, name: a.clientName, count: 0 };
    c.count++;
    map.set(a.clientId, c);
  }
  return [...map.values()];
});

/** Applies the ?account= / ?client= filters from the URL to the user's accessible accounts. */
export async function selectAccounts(user: CurrentUser, params: { account?: string; client?: string }) {
  const all = await getAccessibleAccounts(user);
  let selected = all;
  if (params.client) selected = selected.filter((a) => a.clientId === params.client);
  if (params.account) selected = selected.filter((a) => a.id === params.account);
  return { all, selected };
}
