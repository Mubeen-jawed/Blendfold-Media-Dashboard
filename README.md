# Blendfold Media Dashboard

Read-only Meta Ads portfolio dashboard for multiple clients. Next.js 15 (App Router) · PostgreSQL · Prisma · Tailwind CSS 4 · Recharts.

## Roles

| Role | Sees |
| --- | --- |
| **Admin** | Every client and ad account, plus the admin panel (users, clients, agencies, ad-account links). |
| **Agency owner** | Every client in their agency, with all of those clients' ad accounts. |
| **Client** | Only the ad accounts linked to their client. A client can have any number of users. |

Only admins create users and set/reset passwords (Admin → Users). Access is enforced on the server for every page, export, and query.

## Pages

Overview · Ad accounts · Campaigns (campaigns / ad sets / ads) · Leads (lead-form submissions) · Audiences · Reports (CSV export) · Alerts · Search · Settings · Admin.

All metrics come from the Meta Marketing API: account info, Insights (spend, impressions, link clicks, purchases and value, leads), campaigns/ad sets/ads, custom and saved audiences, and lead-form leads. The dashboard leads with purchases & ROAS or leads & CPL, whichever the selected accounts report more of; switch via **Add filter → Primary result**.

Alerts are computed from that data: disabled/unsettled accounts, spend cap reached, disapproved ads, spend or cost-per-result up ≥30% vs. the previous period, and no delivery. Email/Slack notifications can reuse `src/lib/alerts.ts`.

## Meta access token

Use a **System User token** from Business Manager (it doesn't expire) with:

- `ads_read`: required
- `business_management`: lists accounts the token can read
- `leads_retrieval` + `pages_show_list` + `pages_read_engagement`, plus access to the Pages that own the lead forms: for the Leads page

Assign the System User to each ad account (and Page) in Business Settings. Optionally set `META_APP_SECRET` so every call is signed with `appsecret_proof`.

Responses are cached for `META_CACHE_SECONDS` (default 15 min) to stay well under rate limits; **Settings → Fetch fresh data now** clears the cache.

## Deploy to a VPS

On a fresh Ubuntu 22.04/24.04 server, from the project root:

```bash
sudo DOMAIN=dash.example.com LETSENCRYPT_EMAIL=you@example.com \
     ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' \
     META_ACCESS_TOKEN='EAAB…' ./deploy.sh
```

It installs Node 22, PostgreSQL and nginx, creates the database and `.env` (with generated secrets), runs migrations, builds, creates the first admin, installs a `blendfold` systemd service, configures nginx and HTTPS (Let's Encrypt), and health-checks the app. Anything you don't pass is prompted for.

Redeploy after changes: `git pull && sudo ./deploy.sh`. Logs: `journalctl -u blendfold -f`.

## Local development

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET; META_MOCK=true for sample data
npm install
npx prisma migrate deploy
npm run create-admin -- you@example.com 'password123' 'Your Name'
npm run seed:demo               # optional demo clients/users (owner@demo.test / client@demo.test, password: demo-password)
npm run dev
```

Other commands: `npm run typecheck`, `npm run build`, `npx prisma migrate dev --name <change>` after editing `prisma/schema.prisma`.

## Layout

```
prisma/schema.prisma        users, agencies, clients, ad accounts, saved views
src/lib/meta/               Graph API client, live + sample providers, caching
src/lib/portfolio.ts        per-account loading and aggregation
src/lib/alerts.ts           alert rules
src/lib/access.ts           role-based account scoping
src/app/(app)/              dashboard pages
src/app/(app)/admin/        admin pages + server actions
src/app/api/export/         CSV exports
deploy.sh                   VPS setup / redeploy
```
