import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleX, CreditCard, Gauge, Activity, TriangleAlert, WifiOff, CirclePause } from "lucide-react";
import type { Alert, AlertKind } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { ArrowLink } from "./ui";

const ICONS: Record<AlertKind, typeof CircleX> = {
  fetch_error: WifiOff,
  account_disabled: CreditCard,
  payment_issue: CreditCard,
  spend_cap: Gauge,
  ads_disapproved: CircleX,
  spend_spike: Activity,
  cost_spike: TriangleAlert,
  no_delivery: CirclePause,
};

export function AlertIcon({ alert, className }: { alert: Alert; className?: string }) {
  const Icon = ICONS[alert.kind] ?? CircleAlert;
  return <Icon className={cn("size-[18px] shrink-0", alert.severity === "critical" ? "text-bad" : "text-warn", className)} strokeWidth={1.8} />;
}

export function NeedsAttention({ alerts, fetched, limit = 4 }: { alerts: Alert[]; fetched: string; limit?: number }) {
  const accounts = new Set(alerts.map((a) => a.accountId)).size;
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4 sm:px-6">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Needs attention</h2>
          <p className="mt-1 text-[13px] text-muted">
            {alerts.length ? `${alerts.length} priority alert${alerts.length === 1 ? "" : "s"} across ${accounts} account${accounts === 1 ? "" : "s"}` : "Nothing needs attention right now"}
          </p>
        </div>
        {alerts.length > 0 && <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[13px] font-semibold text-warn">{alerts.length}</span>}
      </div>
      <ul>
        {alerts.slice(0, limit).map((a) => (
          <li key={a.id} className="border-b border-line px-5 py-4 last:border-0 sm:px-6">
            <div className="flex items-center gap-2.5">
              <AlertIcon alert={a} />
              <span className="flex-1 text-[15px] font-medium text-ink">{a.title}</span>
              <span className={cn("size-1.5 rounded-full", a.severity === "critical" ? "bg-bad" : "bg-warn")} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs">
              <span className="font-medium text-ink-2">{a.accountName}</span>
              <span className="text-muted">Last fetched {fetched}</span>
            </div>
            <p className="mt-2 text-[13px] text-ink-2">{a.message}</p>
            <ArrowLink href={a.href} className="mt-2">
              {a.actionLabel}
            </ArrowLink>
          </li>
        ))}
      </ul>
      {alerts.length > limit && (
        <div className="border-t border-line py-3.5 text-center">
          <Link href="/alerts" className="link text-[13px]">
            View all {alerts.length} alerts →
          </Link>
        </div>
      )}
    </section>
  );
}

export function CompactAlerts({ alerts, title, subtitle, href = "/alerts", linkLabel = "View all alerts →" }: { alerts: Alert[]; title: string; subtitle: string; href?: string; linkLabel?: string }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        </div>
        <Link href={href} className="link text-[13px] whitespace-nowrap">
          {linkLabel}
        </Link>
      </div>
      {alerts.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No alerts for these accounts.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {alerts.slice(0, 5).map((a) => (
            <li key={a.id} className="flex gap-3">
              <AlertIcon alert={a} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <Link href={a.href} className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{a.title}</span>
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">{a.accountName}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted sm:hidden" />
                </Link>
                <p className="mt-0.5 text-xs text-muted">{a.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
