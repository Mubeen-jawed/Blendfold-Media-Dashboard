"use client";

import { Fragment, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type LeadItem = {
  id: string;
  createdTime: string;
  accountName: string;
  campaignName: string;
  adName: string;
  fields: { name: string; values: string[] }[];
};

const NAME_KEYS = ["full_name", "first_name", "last_name", "name"];
const EMAIL_KEYS = ["email", "work_email"];
const PHONE_KEYS = ["phone_number", "phone", "work_phone_number"];

function field(lead: LeadItem, keys: string[]) {
  return keys.map((k) => lead.fields.find((f) => f.name.toLowerCase() === k)?.values.join(", ")).filter(Boolean);
}

function leadName(l: LeadItem) {
  const full = field(l, ["full_name", "name"])[0];
  if (full) return full;
  const parts = field(l, ["first_name", "last_name"]);
  return parts.length ? parts.join(" ") : "—";
}

const label = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function LeadsTable({ leads }: { leads: LeadItem[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = q
    ? leads.filter((l) => `${l.campaignName} ${l.adName} ${l.accountName} ${l.fields.map((f) => f.values.join(" ")).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    : leads;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div>
          <h2 className="flex items-baseline gap-2 text-[17px] font-semibold text-ink">
            Lead submissions <span className="text-[13px] font-normal text-muted">{leads.length}</span>
          </h2>
          <p className="mt-1 text-[13px] text-muted">Instant form submissions from Meta lead ads. Newest first.</p>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a lead" className="input w-[220px] pl-9" />
        </label>
      </div>
      <div className="scroll-x border-t border-line">
        <table className="w-full min-w-[900px]">
          <thead className="bg-sunken">
            <tr className="border-b border-line">
              <th className="th">Submitted</th>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Phone</th>
              <th className="th">Campaign · Ad</th>
              <th className="th">Account</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const isOpen = open === l.id;
              const known = new Set([...NAME_KEYS, ...EMAIL_KEYS, ...PHONE_KEYS]);
              const extra = l.fields.filter((f) => !known.has(f.name.toLowerCase()));
              return (
                <Fragment key={l.id}>
                  <tr className={cn("cursor-pointer border-b border-line hover:bg-sunken/60", isOpen && "bg-sunken/60")} onClick={() => setOpen(isOpen ? null : l.id)}>
                    <td className="td text-[13px] text-ink-2">
                      {new Date(l.createdTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="td font-medium">{leadName(l)}</td>
                    <td className="td text-ink-2">{field(l, EMAIL_KEYS)[0] ?? "—"}</td>
                    <td className="td tabular text-ink-2">{field(l, PHONE_KEYS)[0] ?? "—"}</td>
                    <td className="td">
                      <div className="max-w-[280px] truncate text-[13px] text-ink">{l.campaignName || "—"}</div>
                      <div className="max-w-[280px] truncate text-xs text-muted">{l.adName}</div>
                    </td>
                    <td className="td text-[13px] text-ink-2">{l.accountName}</td>
                    <td className="td">
                      <ChevronDown className={cn("size-4 text-muted transition-transform", isOpen && "rotate-180")} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line bg-sunken/40">
                      <td colSpan={7} className="px-5 py-4 sm:px-6">
                        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                          {(extra.length ? extra : l.fields).map((f) => (
                            <div key={f.name} className="min-w-0">
                              <dt className="text-xs text-muted">{label(f.name)}</dt>
                              <dd className="text-sm break-words text-ink">{f.values.join(", ") || "—"}</dd>
                            </div>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted">
                  {leads.length ? "No leads match your search." : "No lead form submissions in this period."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
