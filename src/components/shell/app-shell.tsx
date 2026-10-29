"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  Bookmark,
  Building2,
  ChevronRight,
  CircleHelp,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ChartNoAxesColumn,
  Users,
  UserRound,
  Wallet,
  X,
  Inbox,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createSavedView, deleteSavedView, logout } from "@/app/actions";

type ShellProps = {
  user: { name: string; email: string; roleLabel: string; isAdmin: boolean };
  accountCount: number;
  alertCount: number;
  savedViews: { id: string; name: string; href: string }[];
  connection: { ok: boolean; label: string; fetched: string };
  children: React.ReactNode;
};

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/accounts", label: "Ad accounts", icon: Wallet, badge: "accounts" as const },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/audiences", label: "Audiences", icon: UsersRound },
  { href: "/reports", label: "Reports", icon: ChartNoAxesColumn },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts" as const },
];

const ADMIN_NAV = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/clients", label: "Clients & accounts", icon: Building2 },
];

const TITLES: Record<string, [string, string]> = {
  "/overview": ["Advertising", "Portfolio overview"],
  "/accounts": ["Advertising", "Ad accounts"],
  "/campaigns": ["Advertising", "Campaigns"],
  "/leads": ["Advertising", "Leads"],
  "/audiences": ["Advertising", "Audiences"],
  "/reports": ["Advertising", "Reports"],
  "/alerts": ["Advertising", "Alerts"],
  "/search": ["Advertising", "Search"],
  "/admin/users": ["Admin", "Users"],
  "/admin/clients": ["Admin", "Clients & accounts"],
  "/settings": ["Workspace", "Settings"],
  "/help": ["Workspace", "Help & resources"],
};

export function AppShell({ user, accountCount, alertCount, savedViews, connection, children }: ShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const crumbs = TITLES[pathname] ?? ["Advertising", ""];

  return (
    <div className="min-h-dvh lg:pl-[250px]">
      {/* Mobile overlay */}
      <div
        className={cn("fixed inset-0 z-40 bg-ink/30 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-line bg-canvas transition-transform lg:w-[250px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between border-b border-line px-6 pt-7 pb-5">
          <Link href="/overview" className="block">
            <div className="text-[20px] leading-tight font-semibold tracking-tight text-ink">Blendfold Media</div>
            <div className="mt-0.5 text-[13px] text-muted">Media portfolio</div>
          </Link>
          <button className="-mr-2 rounded-lg p-1.5 text-muted hover:bg-sunken lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="border-b border-line px-[18px] py-5">
            <div className="eyebrow mb-2 px-0.5">Workspace</div>
            <ul className="space-y-1.5">
              {NAV.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                  count={item.badge === "accounts" ? accountCount : item.badge === "alerts" ? alertCount : undefined}
                />
              ))}
            </ul>
          </div>

          {user.isAdmin && (
            <div className="border-b border-line px-[18px] py-5">
              <div className="eyebrow mb-2 px-0.5">Admin</div>
              <ul className="space-y-1.5">
                {ADMIN_NAV.map((item) => (
                  <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
                ))}
              </ul>
            </div>
          )}

          <SavedViews views={savedViews} />

          <div className="border-b border-line bg-sunken/60 px-[18px] py-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <span className={cn("size-1.5 rounded-full", connection.ok ? "bg-good" : "bg-warn")} />
              {connection.label}
            </div>
            <div className="mt-1 pl-3.5 text-xs text-muted">Last fetched {connection.fetched}</div>
          </div>

          <ul className="space-y-0.5 px-[18px] py-3">
            <li>
              <Link href="/settings" className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-surface", pathname === "/settings" && "bg-brand-soft text-brand-ink")}>
                <Settings className="size-[18px] text-muted" /> Settings
              </Link>
            </li>
            <li>
              <Link href="/help" className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-surface", pathname === "/help" && "bg-brand-soft text-brand-ink")}>
                <CircleHelp className="size-[18px] text-muted" /> Help &amp; resources
              </Link>
            </li>
          </ul>
        </nav>

        <UserCard user={user} />
      </aside>

      <header className="sticky top-0 z-30 flex h-[64px] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:h-[76px] lg:px-9">
        <button className="-ml-1 rounded-lg p-2 text-ink-2 hover:bg-sunken lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <nav className="flex min-w-0 items-center gap-2.5 text-[15px]">
          <span className="hidden text-muted sm:inline">{crumbs[0]}</span>
          <ChevronRight className="hidden size-4 text-subtle sm:block" />
          <span className="truncate font-medium text-ink">{crumbs[1]}</span>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <SearchBox />
          <Link href="/help" className="hidden rounded-lg p-2 text-ink-2 hover:bg-sunken sm:block" aria-label="Help">
            <CircleHelp className="size-[22px]" strokeWidth={1.6} />
          </Link>
          <Link href="/alerts" className="relative rounded-lg p-2 text-ink-2 hover:bg-sunken" aria-label={`${alertCount} alerts`}>
            <Bell className="size-[22px]" strokeWidth={1.6} />
            {alertCount > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full border-2 border-surface bg-brand" />}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 lg:px-9 lg:py-9">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  count,
}: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
  count?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] transition-colors",
          active ? "bg-brand-soft font-medium text-brand-ink" : "bg-surface/60 text-ink-2 hover:bg-surface",
        )}
      >
        <Icon className={cn("size-[19px]", active ? "text-brand-ink" : "text-muted")} strokeWidth={1.7} />
        <span className="flex-1">{label}</span>
        {count != null && count > 0 && <span className="text-[13px] text-muted">{count}</span>}
      </Link>
    </li>
  );
}

function SavedViews({ views }: { views: { id: string; name: string; href: string }[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const current = `${pathname}${params.size ? `?${params.toString()}` : ""}`;

  return (
    <div className="border-b border-line px-[18px] py-5">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="eyebrow">Saved views</span>
        <button onClick={() => setAdding((v) => !v)} className="rounded p-0.5 text-muted hover:bg-surface hover:text-ink" aria-label="Save current view">
          <Plus className="size-4" />
        </button>
      </div>
      {adding && (
        <form
          className="mb-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            start(async () => {
              await createSavedView({ name, href: current });
              setName("");
              setAdding(false);
            });
          }}
        >
          <input autoFocus className="input h-9 text-[13px]" placeholder="Name this view" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary h-9 px-3 text-[13px]" disabled={pending}>
            Save
          </button>
        </form>
      )}
      <ul className="space-y-2">
        {views.length === 0 && !adding && <li className="px-0.5 text-xs text-muted">Save filters you use often with +.</li>}
        {views.map((v) => (
          <li key={v.id} className="group relative">
            <Link
              href={v.href}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 pr-8 text-sm text-ink-2 hover:border-line-strong",
                current === v.href && "border-brand/40 text-brand-ink",
              )}
            >
              <Bookmark className="size-4 shrink-0 text-muted" strokeWidth={1.7} />
              <span className="truncate">{v.name}</span>
            </Link>
            <button
              onClick={() => start(() => deleteSavedView(v.id))}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle opacity-0 group-hover:opacity-100 hover:text-bad focus:opacity-100"
              aria-label={`Remove ${v.name}`}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserCard({ user }: { user: ShellProps["user"] }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div ref={ref} className="relative border-t border-line px-[18px] py-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-good-soft text-[13px] font-semibold text-good">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-ink">{user.name}</div>
          <div className="truncate text-xs text-muted">{user.roleLabel}</div>
        </div>
        <button onClick={() => setMenu((m) => !m)} className="rounded-lg p-1.5 text-muted hover:bg-surface" aria-label="Account menu">
          <MoreHorizontal className="size-5" />
        </button>
      </div>
      {menu && (
        <div className="absolute right-4 bottom-[68px] left-4 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <div className="truncate px-2.5 py-2 text-xs text-muted">{user.email}</div>
          <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-sunken">
            <UserRound className="size-4" /> Profile &amp; settings
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-bad hover:bg-bad-soft">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="relative hidden md:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search accounts, campaigns..."
        className="h-10 w-[200px] rounded-full border border-line bg-surface pr-4 pl-10 text-sm outline-none placeholder:text-muted focus:border-brand lg:w-[260px]"
      />
    </form>
  );
}
