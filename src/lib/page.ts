import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth/user";
import { selectAccounts, getAccessibleAccounts, type AccountRef } from "@/lib/access";
import { resolveRange, DEFAULT_PRESET, type DateRange } from "@/lib/dates";
import { loadPortfolio } from "@/lib/portfolio";
import { computeAlerts } from "@/lib/alerts";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Common page setup: auth, URL filters, date range. */
export async function pageContext(searchParams: SearchParams) {
  const sp = await searchParams;
  const user = await requireUser();
  const params = {
    account: str(sp.account),
    client: str(sp.client),
    range: str(sp.range),
    since: str(sp.since),
    until: str(sp.until),
    result: str(sp.result),
  };
  const range = resolveRange(params);
  const { all, selected } = await selectAccounts(user, params);
  // An account id that isn't accessible is silently ignored, never trusted.
  const accountId = selected.length === 1 && params.account ? params.account : undefined;
  return { sp, user, params, range, all, selected, accountId };
}

/** Alert badge data for the shell, always over the default 28-day window. */
export const shellAlerts = cache(async (accounts: AccountRef[]) => {
  const range: DateRange = resolveRange({ range: DEFAULT_PRESET });
  const portfolio = await loadPortfolio(accounts, range);
  return { alerts: computeAlerts(portfolio.rows, range), fetchedAt: portfolio.fetchedAt, errors: portfolio.rows.filter((r) => r.error).length };
});

export { getAccessibleAccounts };
