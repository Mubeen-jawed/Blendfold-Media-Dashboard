import { change } from "@/lib/format";
import { costPerResult, resolveResultMode, RESULT_LABEL } from "@/lib/metrics";
import type { AccountSummary } from "@/lib/portfolio";
import { rangeDays, type DateRange } from "@/lib/dates";

export type AlertKind =
  | "fetch_error"
  | "account_disabled"
  | "payment_issue"
  | "spend_cap"
  | "ads_disapproved"
  | "spend_spike"
  | "cost_spike"
  | "no_delivery";

export type Alert = {
  id: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  title: string;
  accountId: string;
  accountName: string;
  message: string;
  actionLabel: string;
  href: string;
};

const SPIKE_THRESHOLD = 30;

export function computeAlerts(rows: AccountSummary[], range: DateRange): Alert[] {
  const days = rangeDays(range);
  const alerts: Alert[] = [];
  for (const r of rows) {
    const base = { accountId: r.ref.id, accountName: r.ref.name };
    const push = (a: Omit<Alert, "id" | "accountId" | "accountName">) => alerts.push({ ...a, ...base, id: `${r.ref.id}:${a.kind}` });
    const accountHref = `/accounts?selected=${r.ref.id}`;

    if (r.error) {
      push({
        kind: "fetch_error",
        severity: "critical",
        title: "Data unavailable",
        message: `Meta returned an error: ${r.error}`,
        actionLabel: "Check connection",
        href: accountHref,
      });
      continue;
    }

    const status = r.info?.status;
    if (status === "DISABLED" || status === "CLOSED") {
      push({
        kind: "account_disabled",
        severity: "critical",
        title: status === "CLOSED" ? "Account closed" : "Account disabled",
        message: "Account is disabled and delivery is paused.",
        actionLabel: "Review account status",
        href: accountHref,
      });
    } else if (status === "UNSETTLED") {
      push({
        kind: "payment_issue",
        severity: "critical",
        title: "Payment issue",
        message: "The account has an unsettled balance; delivery may be paused.",
        actionLabel: "Review account status",
        href: accountHref,
      });
    }

    if (r.info?.spendCap && r.info.amountSpent >= r.info.spendCap * 0.99) {
      push({
        kind: "spend_cap",
        severity: "warning",
        title: "Spend cap reached",
        message: "Spend cap reached for this account.",
        actionLabel: "Review spend cap",
        href: accountHref,
      });
    }

    if (r.disapproved > 0) {
      push({
        kind: "ads_disapproved",
        severity: "critical",
        title: `${r.disapproved} ad${r.disapproved === 1 ? "" : "s"} disapproved`,
        message: `${r.disapproved} ad${r.disapproved === 1 ? " is" : "s are"} disapproved and not delivering.`,
        actionLabel: "Review disapproved ads",
        href: `/campaigns?account=${r.ref.id}&tab=ads&delivery=DISAPPROVED`,
      });
    }

    const spendChange = change(r.current.spend, r.previous.spend);
    if (spendChange != null && spendChange >= SPIKE_THRESHOLD && r.previous.spend >= 50) {
      push({
        kind: "spend_spike",
        severity: "warning",
        title: "Spend increased vs. previous period",
        message: `App-calculated: spend rose ${Math.round(spendChange)}% vs. the previous ${days}-day period.`,
        actionLabel: "Review spend trend",
        href: `/campaigns?account=${r.ref.id}`,
      });
    }

    const mode = resolveResultMode(undefined, r.current);
    const costChange = change(costPerResult(r.current, mode), costPerResult(r.previous, mode));
    const volume = mode === "leads" ? r.current.leads : r.current.purchases;
    if (costChange != null && costChange >= SPIKE_THRESHOLD && volume >= 5) {
      push({
        kind: "cost_spike",
        severity: "warning",
        title: `${RESULT_LABEL[mode].cost} increased`,
        message: `App-calculated: ${RESULT_LABEL[mode].cost.toLowerCase()} rose ${Math.round(costChange)}% vs. the previous ${days}-day period.`,
        actionLabel: "Review campaigns",
        href: `/campaigns?account=${r.ref.id}`,
      });
    }

    if (status === "ACTIVE" && r.current.spend === 0 && r.previous.spend > 0) {
      push({
        kind: "no_delivery",
        severity: "warning",
        title: "No delivery this period",
        message: "The account spent in the previous period but has no spend in the selected period.",
        actionLabel: "Review campaigns",
        href: `/campaigns?account=${r.ref.id}`,
      });
    }
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}
