"use client";

import { useMemo, useState } from "react";
import { ChevronRight, CircleUser, ExternalLink, Info, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { Pill, StatusPill } from "./ui";
import type { AudienceRow } from "@/lib/meta/types";

export type AudienceItem = AudienceRow & { accountName: string; accountMetaId: string };

const unavailableReason = (a: AudienceItem) =>
  a.kind === "saved" ? "Not provided for this view" : a.availability === "Populating" ? "Not yet reported" : a.availabilityNote || "Platform privacy limits";

function sizeText(a: AudienceItem) {
  if (a.sizeLower && a.sizeUpper) return `${num(a.sizeLower)}–${num(a.sizeUpper)}`;
  if (a.sizeLower) return `${num(a.sizeLower)}+`;
  return null;
}

export function AudiencesExplorer({ items }: { items: AudienceItem[] }) {
  const [tab, setTab] = useState<"all" | "custom" | "saved">("all");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [availability, setAvailability] = useState("");
  const [selectedId, setSelectedId] = useState(items[0]?.id);

  const sources = useMemo(() => [...new Set(items.map((i) => i.source))].sort(), [items]);
  const filtered = items.filter(
    (a) =>
      (tab === "all" || a.kind === tab) &&
      (!q || `${a.name} ${a.description} ${a.accountName}`.toLowerCase().includes(q.toLowerCase())) &&
      (!type || a.source === type) &&
      (!availability || a.availability === availability),
  );
  const selected = items.find((a) => a.id === selectedId) ?? filtered[0];
  const counts = { all: items.length, custom: items.filter((i) => i.kind === "custom").length, saved: items.filter((i) => i.kind === "saved").length };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="card overflow-hidden">
        <div className="px-5 sm:px-6">
          <div className="flex gap-7 border-b border-line">
            {(["all", "custom", "saved"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("-mb-px border-b-2 pt-5 pb-3 text-[15px]", tab === t ? "border-brand font-medium text-brand-ink" : "border-transparent text-ink-2 hover:text-ink")}
              >
                {t === "all" ? "All audiences" : t === "custom" ? "Custom" : "Saved"}
                <span className="ml-2 text-[13px]">{counts[t]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5 py-4">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an audience" className="input w-[210px] pl-9" />
            </label>
            <div className="flex flex-wrap gap-2.5">
              <select value={type} onChange={(e) => setType(e.target.value)} className="btn appearance-none pr-8" aria-label="Type">
                <option value="">Type: All</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="btn appearance-none pr-8" aria-label="Availability">
                <option value="">Availability: All</option>
                {["Ready", "Populating", "Accessible", "Unavailable"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="scroll-x border-t border-line">
          <table className="w-full min-w-[700px]">
            <thead className="bg-sunken">
              <tr className="border-b border-line">
                <th className="th">Audience</th>
                <th className="th">Ad account</th>
                <th className="th">Type</th>
                <th className="th">Availability</th>
                <th className="th">Estimated size</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const size = sizeText(a);
                const isSel = a.id === selected?.id;
                return (
                  <tr key={`${a.accountMetaId}:${a.id}`} onClick={() => setSelectedId(a.id)} className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-sunken/60", isSel && "bg-brand-soft/40")}>
                    <td className="td">
                      <div className={cn("max-w-[240px] truncate text-[15px] 2xl:max-w-[380px]", isSel ? "text-brand-ink" : "text-ink")}>{a.name}</div>
                      {a.description && <div className="mt-0.5 max-w-[240px] truncate text-xs text-muted 2xl:max-w-[380px]">{a.description}</div>}
                    </td>
                    <td className="td text-ink-2">{a.accountName}</td>
                    <td className="td">
                      <div className="text-[13px] text-ink">{a.kind === "custom" ? "Custom" : "Saved"}</div>
                      <div className="text-xs text-muted">{a.source}</div>
                    </td>
                    <td className="td">
                      <StatusPill status={a.availability} />
                    </td>
                    <td className="td">
                      <div className="tabular text-[13px] text-ink">{size ?? "Unavailable"}</div>
                      <div className="text-xs text-muted">{size ? "Approximate range" : unavailableReason(a)}</div>
                    </td>
                    <td className="td pl-0">
                      <ChevronRight className="size-4 text-muted" />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                    {items.length ? "No audiences match these filters." : "No accessible audiences in these accounts."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t border-line px-5 py-3.5 text-xs text-muted sm:px-6">
          <span>{items.length} accessible audiences</span>
          <span>
            {filtered.length ? `1–${filtered.length}` : 0} of {items.length}
          </span>
        </div>
      </section>

      <div className="space-y-6">
        {selected && (
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Audience details</span>
              <MoreHorizontal className="size-5 text-muted" />
            </div>
            <div className="mt-4 flex items-start gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-brand-soft text-brand-ink">
                <CircleUser className="size-5" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <div className="text-[17px] font-semibold text-ink">{selected.name}</div>
                <div className="text-xs text-muted">
                  {selected.accountName} · ID ending {selected.id.slice(-4)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-b border-line pb-5">
              <StatusPill status={selected.availability} />
              <Pill tone="brand">{selected.kind === "custom" ? "Custom audience" : "Saved audience"}</Pill>
            </div>
            {selected.description && (
              <div className="mt-4">
                <div className="eyebrow">Description</div>
                <p className="mt-1.5 text-sm text-ink-2">{selected.description}</p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="eyebrow">Source</div>
                <div className="mt-1 text-sm text-ink">{selected.source}</div>
              </div>
              <div>
                <div className="eyebrow">Retention</div>
                <div className="mt-1 text-sm text-ink">{selected.retentionDays ? `${selected.retentionDays} days` : "—"}</div>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-sunken p-4">
              <div className="text-[13px] text-muted">Approximate audience size</div>
              <div className="tabular mt-1 text-[28px] font-semibold text-ink">{sizeText(selected) ?? "Unavailable"}</div>
              <p className="mt-1 text-xs text-muted">
                {sizeText(selected) ? "Platform-reported range, not an exact count or a guarantee of delivery." : unavailableReason(selected)}
              </p>
            </div>
            <div className="mt-4 flex gap-2.5 rounded-xl bg-sunken px-4 py-3 text-[13px] text-muted">
              <Info className="mt-0.5 size-4 shrink-0" />
              Size and availability depend on platform privacy thresholds, audience processing, and account permissions.
            </div>
            <a
              href={`https://adsmanager.facebook.com/adsmanager/audiences?act=${selected.accountMetaId.replace(/^act_/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-5"
            >
              <ExternalLink className="size-[18px]" /> Open audience in Ads Manager
            </a>
          </section>
        )}
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ink">Access, not membership</h2>
            <ShieldCheck className="size-5 text-muted" strokeWidth={1.6} />
          </div>
          <p className="mt-3 text-[13px] text-ink-2">Only audiences accessible to the connected Meta user are listed. Member identities are never exposed.</p>
          <p className="mt-3 text-xs text-muted">An accessible audience does not mean a disabled account can deliver ads.</p>
        </section>
      </div>
    </div>
  );
}
