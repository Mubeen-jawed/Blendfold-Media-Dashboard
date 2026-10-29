"use client";

import { useState } from "react";
import { KeyRound, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Pill } from "@/components/ui";
import { createUser, deleteUser, resetPassword, updateUser } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/cn";

type Role = "ADMIN" | "AGENCY_OWNER" | "CLIENT";
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  agencyId: string | null;
  clientId: string | null;
  scope: string;
  lastLoginAt: string | null;
};
type Option = { id: string; name: string };

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", AGENCY_OWNER: "Agency owner", CLIENT: "Client" };
const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Full access: every client, every ad account, and this admin panel.",
  AGENCY_OWNER: "Sees every client (and their ad accounts) in the assigned agency.",
  CLIENT: "Sees only the ad accounts of the assigned client.",
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function PasswordField({ name = "password", label = "Password" }: { name?: string; label?: string }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input name={name} type="text" required minLength={8} value={value} onChange={(e) => setValue(e.target.value)} className="input font-mono" autoComplete="new-password" placeholder="At least 8 characters" />
        <button type="button" className="btn shrink-0" onClick={() => setValue(generatePassword())}>
          Generate
        </button>
      </div>
    </div>
  );
}

function RoleFields({ agencies, clients, defaults }: { agencies: Option[]; clients: Option[]; defaults?: Partial<AdminUser> }) {
  const [role, setRole] = useState<Role>(defaults?.role ?? "CLIENT");
  return (
    <>
      <div>
        <label className="label">Role</label>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
          <option value="CLIENT">Client</option>
          <option value="AGENCY_OWNER">Agency owner</option>
          <option value="ADMIN">Admin</option>
        </select>
        <p className="mt-1.5 text-xs text-muted">{ROLE_HELP[role]}</p>
      </div>
      {role === "AGENCY_OWNER" && (
        <div>
          <label className="label">Agency</label>
          <select name="agencyId" defaultValue={defaults?.agencyId ?? ""} className="input" required>
            <option value="">Select an agency…</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {agencies.length === 0 && <p className="mt-1.5 text-xs text-warn">Create an agency in Clients &amp; accounts first.</p>}
        </div>
      )}
      {role === "CLIENT" && (
        <div>
          <label className="label">Client</label>
          <select name="clientId" defaultValue={defaults?.clientId ?? ""} className="input" required>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clients.length === 0 && <p className="mt-1.5 text-xs text-warn">Create a client in Clients &amp; accounts first.</p>}
        </div>
      )}
    </>
  );
}

export function UsersManager({ users, agencies, clients, currentUserId }: { users: AdminUser[]; agencies: Option[]; clients: Option[]; currentUserId: string }) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const filtered = users.filter(
    (u) => (!roleFilter || u.role === roleFilter) && (!q || `${u.name} ${u.email} ${u.scope}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {creating ? (
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ink">New user</h2>
            <button onClick={() => setCreating(false)} className="rounded-lg p-1.5 text-muted hover:bg-sunken" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <ActionForm action={createUser} resetOnSuccess className="mt-4">
            {(pending) => (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Full name</label>
                  <input name="name" required className="input" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input name="email" type="email" required className="input" autoComplete="off" />
                </div>
                <PasswordField />
                <RoleFields agencies={agencies} clients={clients} />
                <div className="md:col-span-2">
                  <button className="btn-primary" disabled={pending}>
                    <UserPlus className="size-4" /> {pending ? "Creating…" : "Create user"}
                  </button>
                </div>
              </div>
            )}
          </ActionForm>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <h2 className="flex items-baseline gap-2 text-[17px] font-semibold text-ink">
            Users <span className="text-[13px] font-normal text-muted">{users.length}</span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find user" className="input w-[200px] pl-9" />
            </label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")} className="btn" aria-label="Role filter">
              <option value="">All roles</option>
              <option value="ADMIN">Admins</option>
              <option value="AGENCY_OWNER">Agency owners</option>
              <option value="CLIENT">Clients</option>
            </select>
            {!creating && (
              <button className="btn-primary" onClick={() => setCreating(true)}>
                <UserPlus className="size-4" /> Add user
              </button>
            )}
          </div>
        </div>
        <div className="scroll-x border-t border-line">
          <table className="w-full min-w-[820px]">
            <thead className="bg-sunken">
              <tr className="border-b border-line">
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Access</th>
                <th className="th">Status</th>
                <th className="th">Last sign-in</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  agencies={agencies}
                  clients={clients}
                  isSelf={u.id === currentUserId}
                  open={editing === u.id}
                  onToggle={() => setEditing(editing === u.id ? null : u.id)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserRow({
  user: u,
  agencies,
  clients,
  isSelf,
  open,
  onToggle,
}: {
  user: AdminUser;
  agencies: Option[];
  clients: Option[];
  isSelf: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={cn("border-b border-line", open && "bg-sunken/60")}>
        <td className="td">
          <div className="text-[15px] text-ink">
            {u.name} {isSelf && <span className="text-xs text-muted">(you)</span>}
          </div>
          <div className="text-xs text-muted">{u.email}</div>
        </td>
        <td className="td">
          <Pill tone={u.role === "ADMIN" ? "brand" : "neutral"} dot={false}>
            {ROLE_LABEL[u.role]}
          </Pill>
        </td>
        <td className="td text-[13px] text-ink-2">{u.scope}</td>
        <td className="td">{u.isActive ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Deactivated</Pill>}</td>
        <td className="td text-[13px] text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}</td>
        <td className="td text-right">
          <button onClick={onToggle} className="btn btn-sm">
            <Pencil className="size-3.5" /> {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-sunken/40">
          <td colSpan={6} className="px-5 py-5 whitespace-normal sm:px-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <ActionForm action={updateUser} className="card p-5">
                {(pending) => (
                  <>
                    <h3 className="text-[15px] font-semibold text-ink">Profile &amp; access</h3>
                    <input type="hidden" name="id" value={u.id} />
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="label">Full name</label>
                        <input name="name" defaultValue={u.name} required className="input" />
                      </div>
                      <div>
                        <label className="label">Email</label>
                        <input name="email" type="email" defaultValue={u.email} required className="input" />
                      </div>
                      <RoleFields agencies={agencies} clients={clients} defaults={u} />
                      <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-ink-2">
                        <input type="checkbox" name="isActive" defaultChecked={u.isActive} className="size-4 accent-brand" disabled={isSelf} />
                        {isSelf && <input type="hidden" name="isActive" value="on" />}
                        Account active (can sign in)
                      </label>
                    </div>
                    <button className="btn-primary mt-4" disabled={pending}>
                      {pending ? "Saving…" : "Save changes"}
                    </button>
                  </>
                )}
              </ActionForm>
              <div className="space-y-4">
                <ActionForm action={resetPassword} resetOnSuccess className="card p-5">
                  {(pending) => (
                    <>
                      <h3 className="text-[15px] font-semibold text-ink">Reset password</h3>
                      <input type="hidden" name="id" value={u.id} />
                      <div className="mt-3">
                        <PasswordField label="New password" />
                      </div>
                      <button className="btn mt-3" disabled={pending}>
                        <KeyRound className="size-4" /> {pending ? "Saving…" : "Set new password"}
                      </button>
                    </>
                  )}
                </ActionForm>
                {!isSelf && (
                  <ActionForm action={deleteUser} confirm={`Delete ${u.email}? This can't be undone.`} className="card p-5">
                    <h3 className="text-[15px] font-semibold text-ink">Delete user</h3>
                    <p className="mt-1 text-xs text-muted">Removes their login. Ad account data is unaffected.</p>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="btn-danger mt-3">
                      <Trash2 className="size-3.5" /> Delete user
                    </button>
                  </ActionForm>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
