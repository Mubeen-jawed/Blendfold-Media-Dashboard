import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("card", className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  count,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="flex items-baseline gap-2 text-[17px] font-semibold text-ink">
          {title}
          {count != null && <span className="text-[13px] font-normal text-muted">{count}</span>}
        </h2>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

type Tone = "good" | "bad" | "warn" | "neutral" | "brand";

const TONE: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-sunken text-ink-2 border border-line/70",
  brand: "bg-brand-soft text-brand-ink",
};

export function Pill({ tone = "neutral", children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-medium whitespace-nowrap", TONE[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  ACTIVE: { tone: "good", label: "Active" },
  PAUSED: { tone: "neutral", label: "Paused" },
  CAMPAIGN_PAUSED: { tone: "neutral", label: "Campaign paused" },
  ADSET_PAUSED: { tone: "neutral", label: "Ad set paused" },
  DISAPPROVED: { tone: "bad", label: "Disapproved" },
  WITH_ISSUES: { tone: "warn", label: "With issues" },
  PENDING_REVIEW: { tone: "warn", label: "In review" },
  IN_PROCESS: { tone: "warn", label: "Processing" },
  PREAPPROVED: { tone: "brand", label: "Preapproved" },
  PENDING_BILLING_INFO: { tone: "warn", label: "Billing needed" },
  ARCHIVED: { tone: "neutral", label: "Archived" },
  DELETED: { tone: "neutral", label: "Deleted" },
  DISABLED: { tone: "bad", label: "Disabled" },
  UNSETTLED: { tone: "warn", label: "Unsettled" },
  PENDING: { tone: "warn", label: "Pending" },
  CLOSED: { tone: "bad", label: "Closed" },
  OTHER: { tone: "neutral", label: "Unknown" },
  Ready: { tone: "good", label: "Ready" },
  Populating: { tone: "warn", label: "Populating" },
  Accessible: { tone: "neutral", label: "Accessible" },
  Unavailable: { tone: "neutral", label: "Unavailable" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { tone: "neutral" as Tone, label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-[11px] font-semibold text-ink-2",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Up/down change indicator. `invert` marks metrics where lower is better (costs). */
export function Delta({ value, suffix = "%", invert = false, className }: { value: number | null; suffix?: string; invert?: boolean; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-[13px] text-subtle", className)}>No prior data</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[13px] font-medium", good ? "text-good" : "text-bad", className)}>
      <Icon className="size-3.5" strokeWidth={2.25} />
      {Math.abs(value).toFixed(1)}
      {suffix === "%" ? "%" : ` ${suffix}`}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  footnote,
  hint,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  footnote?: React.ReactNode;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink-2">{label}</span>
        {hint && (
          <span title={hint} className="text-subtle">
            <Info className="size-4" />
          </span>
        )}
      </div>
      <div className={cn("tabular mt-4 truncate text-[24px] leading-none sm:mt-5 sm:text-[30px] font-semibold tracking-tight text-ink", valueClassName)}>{value}</div>
      {delta && <div className="mt-2.5">{delta}</div>}
      {footnote && <div className="mt-auto truncate pt-4 text-xs text-muted sm:pt-6">{footnote}</div>}
    </div>
  );
}

export function StatCard({ label, value, note, valueClassName }: { label: string; value: React.ReactNode; note?: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="card min-w-0 p-4 sm:p-5">
      <div className="truncate text-sm text-ink-2">{label}</div>
      <div className={cn("tabular mt-3 truncate text-[24px] sm:text-[30px] leading-tight font-semibold text-ink", valueClassName)}>{value}</div>
      {note && <div className="mt-2 truncate text-[13px] text-muted">{note}</div>}
    </div>
  );
}

export function Callout({ icon: Icon, children, tone = "good" }: { icon?: LucideIcon; children: React.ReactNode; tone?: "good" | "neutral" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px]",
        tone === "good" ? "bg-good-soft/80 text-good" : "bg-sunken text-muted",
      )}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink hover:underline", className)}>
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-ink">{children}</dd>
    </div>
  );
}
