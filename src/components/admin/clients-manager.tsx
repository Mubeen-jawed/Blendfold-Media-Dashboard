"use client";

import { useState } from "react";
import { Building2, Link2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar, Pill } from "@/components/ui";
import {
  addAdAccounts,
  createAgency,
  createClient,
  deleteAgency,
  deleteClient,
  removeAdAccount,
  renameAgency,
  updateAdAccount,
  updateClient,
} from "@/app/(app)/admin/actions";

type Option = { id: string; name: string };
export type AdminClient = {
  id: string;
  name: string;
  agencyId: string | null;
  agencyName: string | null;
  userCount: number;
  accounts: { id: string; metaId: string; name: string }[];
};
export type AdminAgency = { id: string; name: string; clientCount: number; ownerCount: number };
export type Discoverable = { id: string; name: string; business: string | null; status: string };

export function ClientsManager({
  agencies,
  clients,
  discoverable,
  discoverError,
  mock,
}: {
  agencies: AdminAgency[];
  clients: AdminClient[];
  discoverable: Discoverable[];
  discoverError: string | null;
  mock: boolean;
}) {
  const [q, setQ] = useState("");
  const [newClient, setNewClient] = useState(false);
  const filtered = clients.filter((c) => !q || `${c.name} ${c.agencyName ?? ""} ${c.accounts.map((a) => `${a.name} ${a.metaId}`).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const linked = new Set(clients.flatMap((c) => c.accounts.map((a) => a.metaId)));
  const unlinked = discoverable.filter((d) => !linked.has(d.id));
  const agencyOptions: Option[] = agencies.map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find client or ad account" className="input w-[260px] pl-9" />
          </label>
          <button className="btn-primary" onClick={() => setNewClient((v) => !v)}>
            <Plus className="size-4" /> New client
          </button>
        </div>

        {newClient && (
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-ink">New client</h2>
              <button onClick={() => setNewClient(false)} className="rounded-lg p-1.5 text-muted hover:bg-sunken" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <ActionForm action={createClient} resetOnSuccess className="mt-4">
              {(pending) => (
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="label">Client name</label>
                    <input name="name" required className="input" placeholder="e.g. Northstar" />
                  </div>
                  <AgencySelect agencies={agencyOptions} />
                  <button className="btn-primary" disabled={pending}>
                    Create client
                  </button>
                </div>
              )}
            </ActionForm>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="card px-6 py-12 text-center text-sm text-muted">{clients.length ? "No clients match." : "No clients yet. Create one to start linking ad accounts."}</div>
        )}

        {filtered.map((c) => (
          <ClientCard key={c.id} client={c} agencies={agencyOptions} clients={clients} unlinked={unlinked} mock={mock} />
        ))}
      </div>

      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Building2 className="size-5 text-muted" strokeWidth={1.6} />
            <h2 className="text-[17px] font-semibold text-ink">Agencies</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted">Group clients under an agency. Agency owners see every client in their agency.</p>
          <ul className="mt-4 divide-y divide-line">
            {agencies.map((a) => (
              <AgencyRow key={a.id} agency={a} />
            ))}
            {agencies.length === 0 && <li className="py-3 text-sm text-muted">No agencies yet.</li>}
          </ul>
          <ActionForm action={createAgency} resetOnSuccess className="mt-4">
            {(pending) => (
              <div className="flex gap-2">
                <input name="name" required placeholder="New agency name" className="input" />
                <button className="btn shrink-0" disabled={pending}>
                  <Plus className="size-4" /> Add
                </button>
              </div>
            )}
          </ActionForm>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold text-ink">Meta connection</h2>
          {mock ? (
            <p className="mt-2 text-[13px] text-warn">Sample data mode: set META_ACCESS_TOKEN (and META_MOCK=false) in .env to read live accounts.</p>
          ) : discoverError ? (
            <p className="mt-2 text-[13px] text-bad">Couldn&apos;t list ad accounts for the token: {discoverError}</p>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-muted">
                The access token can read <strong className="text-ink">{discoverable.length}</strong> ad accounts. {unlinked.length} aren&apos;t linked to a client yet.
              </p>
              {unlinked.length > 0 && (
                <ul className="mt-3 max-h-[280px] space-y-1 overflow-y-auto">
                  {unlinked.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-sunken">
                      <span className="min-w-0 truncate text-ink-2">{d.name}</span>
                      <span className="shrink-0 text-xs text-muted">{d.id.replace("act_", "…").slice(-6)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function AgencySelect({ agencies, defaultValue }: { agencies: Option[]; defaultValue?: string | null }) {
  return (
    <div>
      <label className="label">Agency</label>
      <select name="agencyId" defaultValue={defaultValue ?? ""} className="input">
        <option value="">No agency</option>
        {agencies.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function AgencyRow({ agency }: { agency: AdminAgency }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="py-3">
      {editing ? (
        <ActionForm action={renameAgency} onSuccess={() => setEditing(false)} showSuccess={false}>
          <input type="hidden" name="id" value={agency.id} />
          <div className="flex gap-2">
            <input name="name" defaultValue={agency.name} required className="input h-9" />
            <button className="btn btn-sm h-9">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-sm h-9">
              Cancel
            </button>
          </div>
        </ActionForm>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{agency.name}</div>
            <div className="text-xs text-muted">
              {agency.clientCount} client{agency.clientCount === 1 ? "" : "s"} · {agency.ownerCount} owner{agency.ownerCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => setEditing(true)} className="btn btn-sm" aria-label={`Rename ${agency.name}`}>
              <Pencil className="size-3.5" />
            </button>
            <ActionForm action={deleteAgency} confirm={`Delete agency “${agency.name}”? Clients are kept.`}>
              <input type="hidden" name="id" value={agency.id} />
              <button className="btn-danger" aria-label={`Delete ${agency.name}`}>
                <Trash2 className="size-3.5" />
              </button>
            </ActionForm>
          </div>
        </div>
      )}
    </li>
  );
}

function ClientCard({ client: c, agencies, clients, unlinked, mock }: { client: AdminClient; agencies: Option[]; clients: AdminClient[]; unlinked: Discoverable[]; mock: boolean }) {
  const [mode, setMode] = useState<null | "edit" | "add">(null);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold text-ink">{c.name}</div>
            <div className="text-xs text-muted">
              {c.agencyName ? `${c.agencyName} · ` : ""}
              {c.accounts.length} ad account{c.accounts.length === 1 ? "" : "s"} · {c.userCount} user{c.userCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode(mode === "add" ? null : "add")} className="btn btn-sm">
            <Link2 className="size-3.5" /> Link ad account
          </button>
          <button onClick={() => setMode(mode === "edit" ? null : "edit")} className="btn btn-sm">
            <Pencil className="size-3.5" /> Edit
          </button>
        </div>
      </div>

      {mode === "edit" && (
        <div className="border-t border-line bg-sunken/50 px-5 py-4 sm:px-6">
          <ActionForm action={updateClient} onSuccess={() => setMode(null)}>
            {(pending) => (
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="id" value={c.id} />
                <div>
                  <label className="label">Client name</label>
                  <input name="name" defaultValue={c.name} required className="input" />
                </div>
                <AgencySelect agencies={agencies} defaultValue={c.agencyId} />
                <button className="btn-primary" disabled={pending}>
                  Save
                </button>
              </div>
            )}
          </ActionForm>
          <ActionForm action={deleteClient} confirm={`Delete client “${c.name}” and unlink its ${c.accounts.length} ad accounts?`} className="mt-3">
            <input type="hidden" name="id" value={c.id} />
            <button className="btn-danger">
              <Trash2 className="size-3.5" /> Delete client
            </button>
          </ActionForm>
        </div>
      )}

      {mode === "add" && (
        <div className="border-t border-line bg-sunken/50 px-5 py-4 sm:px-6">
          <ActionForm action={addAdAccounts} resetOnSuccess>
            {(pending) => (
              <>
                <input type="hidden" name="clientId" value={c.id} />
                {unlinked.length > 0 && (
                  <div className="mb-4">
                    <div className="label">Pick from accounts the token can read</div>
                    <div className="grid max-h-[220px] grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-line bg-surface p-2 sm:grid-cols-2">
                      {unlinked.map((d) => (
                        <label key={d.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-sunken">
                          <input type="checkbox" name="pick" value={d.id} className="size-4 accent-brand" />
                          <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
                          <span className="text-xs text-muted">{d.id.slice(-4)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="label">{unlinked.length ? "…or enter ad account IDs" : "Ad account ID(s)"}</label>
                    <input name="metaId" className="input" placeholder="act_1234567890, 9876543210" />
                  </div>
                  <div>
                    <label className="label">Display name {mock ? "" : "(optional)"}</label>
                    <input name="name" className="input" placeholder={mock ? "e.g. Northstar · US" : "Defaults to the Meta name"} />
                  </div>
                  <button className="btn-primary" disabled={pending}>
                    {pending ? "Linking…" : "Link"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">Linking only grants dashboard visibility. Nothing is changed in Meta.</p>
              </>
            )}
          </ActionForm>
        </div>
      )}

      {c.accounts.length > 0 && (
        <ul className="border-t border-line">
          {c.accounts.map((a) => (
            <li key={a.id} className="border-b border-line px-5 py-3 last:border-0 sm:px-6">
              {editingAccount === a.id ? (
                <ActionForm action={updateAdAccount} onSuccess={() => setEditingAccount(null)} showSuccess={false}>
                  <input type="hidden" name="id" value={a.id} />
                  <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                    <div>
                      <label className="label">Display name</label>
                      <input name="name" defaultValue={a.name} required className="input h-9" />
                    </div>
                    <div>
                      <label className="label">Client</label>
                      <select name="clientId" defaultValue={c.id} className="input h-9">
                        {clients.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="btn-primary h-9">Save</button>
                    <button type="button" onClick={() => setEditingAccount(null)} className="btn h-9">
                      Cancel
                    </button>
                  </div>
                </ActionForm>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{a.name}</div>
                    <div className="text-xs text-muted">{a.metaId}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pill tone="brand">Linked</Pill>
                    <button onClick={() => setEditingAccount(a.id)} className="btn btn-sm" aria-label={`Edit ${a.name}`}>
                      <Pencil className="size-3.5" />
                    </button>
                    <ActionForm action={removeAdAccount} confirm={`Unlink ${a.name} from ${c.name}?`} showSuccess={false}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn-danger" aria-label={`Unlink ${a.name}`}>
                        <X className="size-3.5" />
                      </button>
                    </ActionForm>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
