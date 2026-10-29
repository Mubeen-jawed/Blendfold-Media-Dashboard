"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { money, multiple, num } from "@/lib/format";
import { Avatar, StatusPill } from "./ui";
import { useQueryUpdater } from "./filters";

export type AccountTableRow = {
  id: string;
  name: string;
  ending: string;
  clientName: string;
  status: string;
  currency: string;
  spend: number;
  roas: number | null;
  results: number;
  cost: number | null;
  linkClicks: number;
  error: string | null;
};

export function AccountsTable({
  title,
  subtitle,
  rows,
  mode,
  variant,
  selectedId,
  total,
  showClient,
  footer,
}: {
  title: string;
  subtitle: string;
  rows: AccountTableRow[];
  mode: "purchases" | "leads";
  variant: "overview" | "accounts";
  selectedId?: string;
  total?: { spend: number; roas: number | null; results: number; cost: number | null; linkClicks: number; statusNote: string; currency: string };
  showClient: boolean;
  footer?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const { update } = useQueryUpdater();
  const filtered = useMemo(
    () => (q ? rows.filter((r) => `${r.name} ${r.clientName} ${r.ending}`.toLowerCase().includes(q.toLowerCase())) : rows),
    [rows, q],
  );
  const leads = mode === "leads";

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div>
          <h2 className="flex items-baseline gap-2 text-[17px] font-semibold text-ink">
            {title}
            {variant === "overview" && <span className="text-[13px] font-normal text-muted">{subtitle}</span>}
          </h2>
          {variant === "accounts" && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find account" className="input h-10 w-[200px] pl-9" />
        </label>
      </div>
      <div className="scroll-x border-t border-line">
        <table className="w-full min-w-[760px]">
          <thead className="bg-sunken">
            <tr className="border-b border-line">
              <th className="th">Account</th>
              <th className="th">{variant === "accounts" ? "Status now" : "Status"}</th>
              {variant === "accounts" && <th className="th">Your access</th>}
              <th className="th">Spend ↓</th>
              <th className="th">{leads ? "Cost / lead" : "ROAS"}</th>
              <th className="th">{leads ? "Leads" : "Purchases"}</th>
              <th className="th">Link clicks</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const href = `/campaigns?account=${r.id}`;
              const selected = r.id === selectedId;
              const metric = leads ? money(r.cost, r.currency, 2) : multiple(r.roas);
              const weak = !leads && r.roas != null && r.roas < 2;
              return (
                <tr
                  key={r.id}
                  onClick={variant === "accounts" ? () => update({ selected: r.id }) : undefined}
                  className={cn("border-b border-line last:border-0", variant === "accounts" && "cursor-pointer hover:bg-sunken/60", selected && "bg-brand-soft/40")}
                >
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <Link href={href} onClick={(e) => e.stopPropagation()} className="block max-w-[260px] truncate text-[15px] text-ink hover:text-brand-ink">
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted">
                          {showClient && `${r.clientName} · `}ID ending {r.ending}
                          {variant === "accounts" && ` · ${r.currency}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="td">{r.error ? <span title={r.error}><StatusPill status="UNSETTLED" /></span> : <StatusPill status={r.status} />}</td>
                  {variant === "accounts" && (
                    <td className="td">
                      <div className="text-[13px] text-ink-2">View performance</div>
                      <div className={cn("text-xs", r.error ? "text-bad" : "text-good")}>{r.error ? "Connection error" : "Connected"}</div>
                    </td>
                  )}
                  <td className="td tabular text-[15px]">{money(r.spend, r.currency, 0)}</td>
                  <td className={cn("td tabular text-[15px]", weak && "text-warn")}>{metric}</td>
                  <td className="td tabular text-[15px]">{num(r.results)}</td>
                  <td className="td tabular text-[13px] text-ink-2">{num(r.linkClicks)}</td>
                  <td className="td">
                    <Link href={href} onClick={(e) => e.stopPropagation()} className="inline-flex rounded p-1 text-muted hover:text-ink" aria-label={`Open ${r.name}`}>
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-sm text-muted">
                  {rows.length ? "No accounts match your search." : "No ad accounts are assigned yet."}
                </td>
              </tr>
            )}
          </tbody>
          {total && filtered.length > 0 && (
            <tfoot className="bg-sunken">
              <tr className="border-t border-line">
                <td className="td font-semibold">Portfolio total</td>
                <td className="td text-xs whitespace-normal text-muted">{total.statusNote}</td>
                {variant === "accounts" && <td className="td text-xs text-muted">{rows.filter((r) => !r.error).length} connected</td>}
                <td className="td tabular text-[15px] font-semibold">{money(total.spend, total.currency, 0)}</td>
                <td className="td tabular text-[15px] font-semibold">{leads ? money(total.cost, total.currency, 2) : multiple(total.roas)}</td>
                <td className="td tabular text-[15px] font-semibold">{num(total.results)}</td>
                <td className="td tabular text-[13px] font-semibold">{num(total.linkClicks)}</td>
                <td className="td" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3.5 text-xs text-muted sm:px-6">{footer}</div>}
    </section>
  );
}
