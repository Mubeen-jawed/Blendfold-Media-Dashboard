import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshButton } from "@/components/filters";
import { DetailRow, PageHeader, Pill } from "@/components/ui";
import { getAccessibleAccounts, getAccessibleClients } from "@/lib/access";
import { requireUser, ROLE_LABEL } from "@/lib/auth/user";
import { isMockMode } from "@/lib/meta";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [accounts, clients] = await Promise.all([getAccessibleAccounts(user), getAccessibleClients(user)]);
  const mock = isMockMode();
  const cacheMinutes = Math.round((Number(process.env.META_CACHE_SECONDS) || 900) / 60);

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader title="Settings" description="Your profile, access, and how data is fetched from Meta." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold text-ink">Profile</h2>
          <dl className="mt-4">
            <DetailRow label="Name">{user.name}</DetailRow>
            <DetailRow label="Email">{user.email}</DetailRow>
            <DetailRow label="Role">{ROLE_LABEL[user.role]}</DetailRow>
            <DetailRow label="Clients">{user.role === "ADMIN" ? "All clients" : clients.map((c) => c.name).join(", ") || "None assigned"}</DetailRow>
            <DetailRow label="Ad accounts">{accounts.length}</DetailRow>
          </dl>
          <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-[13px] text-muted">
            To change your email or password, contact your Blendfold admin.
          </p>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ink">Data &amp; connection</h2>
            {mock ? <Pill tone="warn">Sample data</Pill> : <Pill tone="good">Live Meta API</Pill>}
          </div>
          <dl className="mt-4">
            <DetailRow label="Source">Meta Marketing API (read-only)</DetailRow>
            {user.role === "ADMIN" && <DetailRow label="API version">{process.env.META_API_VERSION || "v23.0"}</DetailRow>}
            <DetailRow label="Refresh">Cached for {cacheMinutes} minutes</DetailRow>
            <DetailRow label="Attribution">Each account&apos;s own setting</DetailRow>
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Suspense>
              <RefreshButton label="Fetch fresh data now" />
            </Suspense>
            <span className="text-xs text-muted">Clears the cache for every account.</span>
          </div>
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-[17px] font-semibold text-ink">Notifications</h2>
          <p className="mt-2 text-[13px] text-muted">
            Email and Slack alerts for disapproved ads, disabled accounts, spend caps and cost spikes are planned. They will use the same rules as the Alerts page.
          </p>
        </section>
      </div>
    </div>
  );
}
