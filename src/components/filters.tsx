"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, ChevronDown, Layers, ListFilter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { RANGE_PRESETS } from "@/lib/dates";
import { refreshMetaData } from "@/app/actions";

export function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null | undefined>, opts?: { scroll?: boolean }) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: opts?.scroll ?? false }));
  };
  return { params, update, pending };
}

export function Popover({
  trigger,
  children,
  align = "left",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+6px)] z-40 max-h-[420px] min-w-[240px] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/5",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ selected, onClick, children, sub }: { selected?: boolean; onClick: () => void; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sunken", selected ? "text-brand-ink" : "text-ink-2")}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {selected && <Check className="size-4 shrink-0" />}
    </button>
  );
}

export type PickerAccount = { id: string; name: string; clientId: string; clientName: string };

export function AccountPicker({
  accounts,
  allowAll = true,
  value,
}: {
  accounts: PickerAccount[];
  allowAll?: boolean;
  value?: string;
}) {
  const { update } = useQueryUpdater();
  const [q, setQ] = useState("");
  const selected = accounts.find((a) => a.id === value);
  const groups = new Map<string, PickerAccount[]>();
  for (const a of accounts) {
    if (q && !`${a.name} ${a.clientName}`.toLowerCase().includes(q.toLowerCase())) continue;
    groups.set(a.clientName, [...(groups.get(a.clientName) ?? []), a]);
  }
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="btn max-w-[260px]">
          <Layers className="size-[18px] text-ink-2" strokeWidth={1.7} />
          <span className="truncate">{selected ? selected.name : `All ad accounts (${accounts.length})`}</span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-[280px]">
          {accounts.length > 6 && (
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find account" className="input mb-1.5 h-9" />
          )}
          {allowAll && (
            <MenuItem
              selected={!value}
              onClick={() => {
                update({ account: null });
                close();
              }}
            >
              All ad accounts ({accounts.length})
            </MenuItem>
          )}
          {[...groups.entries()].map(([client, list]) => (
            <div key={client} className="mt-1">
              {groups.size > 1 && <div className="eyebrow px-2.5 pt-2 pb-1">{client}</div>}
              {list.map((a) => (
                <MenuItem
                  key={a.id}
                  selected={a.id === value}
                  onClick={() => {
                    update({ account: a.id, campaign: null });
                    close();
                  }}
                >
                  {a.name}
                </MenuItem>
              ))}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function AddFilter({
  clients,
  clientId,
  showResult = true,
  result,
}: {
  clients: { id: string; name: string }[];
  clientId?: string;
  showResult?: boolean;
  result?: string;
}) {
  const { update } = useQueryUpdater();
  const activeCount = (clientId ? 1 : 0) + (result ? 1 : 0);
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="btn">
          <ListFilter className="size-[18px]" strokeWidth={1.7} />
          {activeCount ? `Filters · ${activeCount}` : "Add filter"}
        </button>
      )}
    >
      {(close) => (
        <div className="w-[260px]">
          {clients.length > 1 && (
            <>
              <div className="eyebrow px-2.5 pt-1.5 pb-1">Client</div>
              <MenuItem selected={!clientId} onClick={() => (update({ client: null, account: null }), close())}>
                All clients
              </MenuItem>
              {clients.map((c) => (
                <MenuItem key={c.id} selected={clientId === c.id} onClick={() => (update({ client: c.id, account: null }), close())}>
                  {c.name}
                </MenuItem>
              ))}
            </>
          )}
          {showResult && (
            <>
              <div className="eyebrow px-2.5 pt-3 pb-1">Primary result</div>
              <MenuItem selected={!result} onClick={() => (update({ result: null }), close())} sub="Uses whichever the accounts report more of">
                Automatic
              </MenuItem>
              <MenuItem selected={result === "purchases"} onClick={() => (update({ result: "purchases" }), close())}>
                Purchases &amp; ROAS
              </MenuItem>
              <MenuItem selected={result === "leads"} onClick={() => (update({ result: "leads" }), close())}>
                Leads &amp; cost per lead
              </MenuItem>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

export function DateRangePicker({ label, preset, since, until }: { label: string; preset: string; since: string; until: string }) {
  const { update } = useQueryUpdater();
  const [from, setFrom] = useState(since);
  const [to, setTo] = useState(until);
  return (
    <Popover
      align="right"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="btn">
          <CalendarDays className="size-[18px]" strokeWidth={1.7} />
          <span className="tabular">{label}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="w-[260px]">
          {RANGE_PRESETS.map((p) => (
            <MenuItem key={p.value} selected={preset === p.value} onClick={() => (update({ range: p.value, since: null, until: null }), close())}>
              {p.label}
            </MenuItem>
          ))}
          <form
            className="mt-1.5 border-t border-line px-1 pt-3 pb-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to && from <= to) {
                update({ since: from, until: to, range: null });
                close();
              }
            }}
          >
            <div className="eyebrow mb-2 px-1">Custom range</div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input h-9 px-2 text-[13px]" aria-label="Start date" />
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input h-9 px-2 text-[13px]" aria-label="End date" />
            </div>
            <button className="btn-primary mt-2 h-9 w-full text-[13px]">Apply</button>
          </form>
        </div>
      )}
    </Popover>
  );
}

export function RefreshButton({ label = "Refresh data" }: { label?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending} onClick={() => start(() => refreshMetaData())}>
      <RefreshCw className={cn("size-[18px]", pending && "animate-spin")} strokeWidth={1.7} />
      {pending ? "Refreshing…" : label}
    </button>
  );
}

export function SelectMenu({
  label,
  value,
  options,
  param,
  extra,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  param: string;
  extra?: Record<string, string | null>;
}) {
  const { update } = useQueryUpdater();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="btn">
          {label ? `${label}: ` : ""}
          {current?.label}
          <ChevronDown className="size-4 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-[220px]">
          {options.map((o) => (
            <MenuItem key={o.value} selected={o.value === current?.value} onClick={() => (update({ [param]: o.value || null, ...extra }), close())}>
              {o.label}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
