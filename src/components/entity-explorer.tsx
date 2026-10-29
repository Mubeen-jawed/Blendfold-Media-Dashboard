"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Layers, Search, ImageOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { money, multiple, num } from "@/lib/format";
import { StatusPill } from "./ui";
import { Popover, useQueryUpdater } from "./filters";
import { Check, ChevronDown } from "lucide-react";

export type EntityRow = {
  id: string;
  name: string;
  sub: string;
  status: string;
  category: string;
  budgetMain: string;
  budgetSub: string;
  spend: number | null;
  results: number | null;
  metric: number | null;
  linkClicks: number | null;
  thumbnail?: string | null;
  note?: string | null;
};

type Tab = "campaigns" | "adsets" | "ads";

const DELIVERY_OPTIONS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "DISAPPROVED", label: "Disapproved" },
  { value: "ISSUES", label: "With issues / in review" },
];

function matchesDelivery(status: string, filter: string) {
  if (!filter) return true;
  if (filter === "PAUSED") return status.includes("PAUSED");
  if (filter === "ISSUES") return ["WITH_ISSUES", "PENDING_REVIEW", "IN_PROCESS", "PENDING_BILLING_INFO"].includes(status);
  return status === filter;
}

function LocalSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="btn">
          {label}: {current.label}
          <ChevronDown className="size-4 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-[220px]">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => (onChange(o.value), close())}
              className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sunken", o.value === value ? "text-brand-ink" : "text-ink-2")}
            >
              {o.label}
              {o.value === value && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function EntityExplorer({
  tab,
  counts,
  rows,
  mode,
  currency,
  selectedCampaign,
  campaignFilterName,
  initialDelivery,
  adsManagerHref,
  total,
  footer,
}: {
  tab: Tab;
  counts: Partial<Record<Tab, number>>;
  rows: EntityRow[];
  mode: "purchases" | "leads";
  currency: string;
  selectedCampaign?: string;
  campaignFilterName?: string;
  initialDelivery?: string;
  adsManagerHref: string;
  total?: { label: string; note: string; spend: number; results: number; metric: number | null; linkClicks: number };
  footer: React.ReactNode;
}) {
  const { update, pending } = useQueryUpdater();
  const [q, setQ] = useState("");
  const [delivery, setDelivery] = useState(initialDelivery ?? "");
  const [category, setCategory] = useState("");
  const leads = mode === "leads";

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (!q || `${r.name} ${r.sub}`.toLowerCase().includes(q.toLowerCase())) &&
      matchesDelivery(r.status, delivery) &&
      (!category || r.category === category),
  );

  const nameCol = tab === "campaigns" ? "Campaign" : tab === "adsets" ? "Ad set" : "Ad";
  const catCol = tab === "campaigns" ? "Objective" : tab === "adsets" ? "Optimization" : "Ad set";
  const tabs: { key: Tab; label: string }[] = [
    { key: "campaigns", label: "Campaigns" },
    { key: "adsets", label: "Ad sets" },
    { key: "ads", label: "Ads" },
  ];

  return (
    <section className={cn("card overflow-hidden", pending && "opacity-80")}>
      <div className="px-5 sm:px-6">
        <div className="scroll-x flex gap-7 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => update({ tab: t.key === "campaigns" ? null : t.key })}
              className={cn(
                "-mb-px border-b-2 pt-5 pb-3 text-[15px] whitespace-nowrap",
                tab === t.key ? "border-brand font-medium text-brand-ink" : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
              {counts[t.key] != null && <span className="ml-2 text-[13px]">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 py-4">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${nameCol.toLowerCase()}`} className="input w-[210px] pl-9" />
          </label>
          <LocalSelect label="Delivery" value={delivery} options={DELIVERY_OPTIONS} onChange={setDelivery} />
          {categories.length > 1 && (
            <LocalSelect
              label={catCol}
              value={category}
              options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c, label: c.length > 28 ? c.slice(0, 28) + "…" : c }))]}
              onChange={setCategory}
            />
          )}
          {campaignFilterName && tab !== "campaigns" && (
            <button onClick={() => update({ campaign: null })} className="btn border-brand/30 bg-brand-soft text-brand-ink">
              Campaign: <span className="max-w-[200px] truncate">{campaignFilterName}</span> ✕
            </button>
          )}
        </div>
      </div>

      {tab === "campaigns" && selectedCampaign && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-brand-soft/60 px-5 py-3 sm:px-6">
          <span className="text-[13px] font-medium text-brand-ink">1 campaign selected</span>
          <span className="hidden h-5 w-px bg-line-strong sm:block" />
          <button className="btn h-9 bg-surface" onClick={() => update({ tab: "adsets" })}>
            <Layers className="size-4" /> View ad sets
          </button>
          <a className="btn h-9 bg-surface" href={adsManagerHref} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Open in Ads Manager
          </a>
          <span className="text-[13px] text-muted">Current delivery and historical performance</span>
        </div>
      )}

      <div className="scroll-x border-t border-line">
        <table className="w-full min-w-[920px]">
          <thead className="bg-sunken">
            <tr className="border-b border-line">
              {tab === "campaigns" && <th className="th w-10 pr-0" />}
              <th className="th">{nameCol}</th>
              <th className="th">Delivery now</th>
              <th className="th">{catCol}</th>
              <th className="th">{tab === "ads" ? "" : "Budget"}</th>
              <th className="th">Spend ↓</th>
              <th className="th">{leads ? "Leads" : "Purchases"}</th>
              <th className="th">{leads ? "Cost / lead" : "ROAS"}</th>
              <th className="th">Link clicks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const selected = r.id === selectedCampaign;
              return (
                <tr key={r.id} className={cn("border-b border-line last:border-0", selected && "bg-brand-soft/40")}>
                  {tab === "campaigns" && (
                    <td className="td w-10 pr-0">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => update({ campaign: selected ? null : r.id })}
                        className="size-[18px] rounded accent-brand"
                        aria-label={`Select ${r.name}`}
                      />
                    </td>
                  )}
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {tab === "ads" &&
                        (r.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.thumbnail} alt="" className="size-10 shrink-0 rounded-lg border border-line object-cover" />
                        ) : (
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-subtle">
                            <ImageOff className="size-4" />
                          </span>
                        ))}
                      <div className="min-w-0">
                        {tab === "campaigns" ? (
                          <button
                            onClick={() => update({ campaign: selected ? null : r.id })}
                            className={cn("block max-w-[360px] truncate text-left text-[15px] hover:text-brand-ink", selected ? "text-brand-ink" : "text-ink")}
                          >
                            {r.name}
                          </button>
                        ) : tab === "adsets" ? (
                          <button onClick={() => update({ tab: "ads", campaign: null, adset: r.id })} className="block max-w-[360px] truncate text-left text-[15px] text-ink hover:text-brand-ink">
                            {r.name}
                          </button>
                        ) : (
                          <span className="block max-w-[360px] truncate text-[15px] text-ink">{r.name}</span>
                        )}
                        <div className="max-w-[360px] truncate text-xs text-muted">{r.sub}</div>
                        {r.note && <div className="max-w-[360px] truncate text-xs text-bad">{r.note}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="td max-w-[180px] truncate text-ink-2">{r.category || "—"}</td>
                  <td className="td">
                    <div className="text-[13px] text-ink">{r.budgetMain}</div>
                    <div className="text-xs text-muted">{r.budgetSub}</div>
                  </td>
                  <td className="td tabular text-[15px]">{r.spend ? money(r.spend, currency, 0) : "—"}</td>
                  <td className="td tabular text-[15px]">{r.spend ? num(r.results) : "—"}</td>
                  <td className="td tabular text-[15px]">{r.spend ? (leads ? money(r.metric, currency, 2) : multiple(r.metric)) : "—"}</td>
                  <td className="td tabular text-[13px] text-ink-2">{r.spend ? num(r.linkClicks) : "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-sm text-muted">
                  {rows.length ? "Nothing matches these filters." : `No ${nameCol.toLowerCase()}s in this account.`}
                </td>
              </tr>
            )}
          </tbody>
          {total && filtered.length > 0 && (
            <tfoot className="bg-sunken">
              <tr className="border-t border-line">
                {tab === "campaigns" && <td className="td" />}
                <td className="td font-semibold">{total.label}</td>
                <td className="td text-xs text-muted">{total.note}</td>
                <td className="td text-xs text-muted">{currency}</td>
                <td className="td text-xs text-muted">Selected period</td>
                <td className="td tabular text-[15px] font-semibold">{money(total.spend, currency, 0)}</td>
                <td className="td tabular text-[15px] font-semibold">{num(total.results)}</td>
                <td className="td tabular text-[15px] font-semibold">{leads ? money(total.metric, currency, 2) : multiple(total.metric)}</td>
                <td className="td tabular text-[13px] font-semibold">{num(total.linkClicks)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3.5 text-xs text-muted sm:px-6">
        {footer}
        <span>
          {filtered.length ? `1–${filtered.length}` : 0} of {rows.length}
        </span>
      </div>
    </section>
  );
}
