import "server-only";
import type { DateRange } from "@/lib/dates";
import { EMPTY_METRICS } from "@/lib/metrics";
import { graphAll, graphGet } from "./graph";
import type {
  AccessibleAccount,
  AccountInfo,
  AccountStatus,
  AdRow,
  AdSetRow,
  AudienceRow,
  CampaignRow,
  DailyPoint,
  LeadRow,
  MetaProvider,
  Metrics,
} from "./types";

type Action = { action_type: string; value: string };
type InsightRow = {
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: Action[];
  action_values?: Action[];
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
};

const INSIGHT_FIELDS = "spend,impressions,reach,clicks,inline_link_clicks,actions,action_values";

// The first action type present wins, so the same conversion is never counted twice.
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];
const LEAD_TYPES = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped"];

function pickAction(list: Action[] | undefined, types: string[]) {
  if (!list) return 0;
  for (const t of types) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

function toMetrics(row: InsightRow | undefined): Metrics {
  if (!row) return { ...EMPTY_METRICS };
  return {
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    reach: Number(row.reach) || 0,
    clicks: Number(row.clicks) || 0,
    linkClicks: Number(row.inline_link_clicks) || 0,
    purchases: pickAction(row.actions, PURCHASE_TYPES),
    purchaseValue: pickAction(row.action_values, PURCHASE_TYPES),
    leads: pickAction(row.actions, LEAD_TYPES),
  };
}

const insightParams = (range: DateRange) => ({
  fields: INSIGHT_FIELDS,
  time_range: { since: range.since, until: range.until },
  use_account_attribution_setting: true,
});

function mapStatus(code: number): AccountStatus {
  if (code === 1) return "ACTIVE";
  if (code === 2) return "DISABLED";
  if (code === 3 || code === 8 || code === 9) return "UNSETTLED";
  if (code === 7 || code === 100) return "PENDING";
  if (code === 101) return "CLOSED";
  return "OTHER";
}

// Budgets and account amounts are returned in the currency's minor unit.
const minor = (v: string | number | undefined | null) => (v == null || v === "" ? null : Number(v) / 100);

async function insightsByLevel(id: string, range: DateRange, level: "campaign" | "adset" | "ad") {
  const rows = await graphAll<InsightRow>(`${id}/insights`, {
    ...insightParams(range),
    fields: `${INSIGHT_FIELDS},${level}_id`,
    level,
  });
  const map = new Map<string, Metrics>();
  for (const r of rows) {
    const key = r[`${level}_id` as const];
    if (key) map.set(key, toMetrics(r));
  }
  return map;
}

function sourceFromSubtype(subtype: string | undefined) {
  switch (subtype) {
    case "WEBSITE":
      return "Website";
    case "CUSTOM":
      return "Customer list";
    case "ENGAGEMENT":
    case "VIDEO":
    case "LEAD_AD":
    case "IG_BUSINESS":
    case "FB_EVENT":
      return "Engagement";
    case "LOOKALIKE":
      return "Lookalike";
    case "APP":
      return "App activity";
    case "OFFLINE_CONVERSION":
      return "Offline activity";
    default:
      return subtype ? subtype.charAt(0) + subtype.slice(1).toLowerCase().replace(/_/g, " ") : "Custom";
  }
}

export const liveProvider: MetaProvider = {
  async account(id) {
    const a = await graphGet<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
      timezone_name: string;
      amount_spent?: string;
      spend_cap?: string;
      disable_reason?: number;
      business?: { name: string };
    }>(id, { fields: "id,name,account_status,currency,timezone_name,amount_spent,spend_cap,disable_reason,business{name}" });
    const cap = minor(a.spend_cap);
    return {
      id: a.id,
      name: a.name,
      status: mapStatus(a.account_status),
      currency: a.currency,
      timezone: a.timezone_name,
      business: a.business?.name ?? null,
      amountSpent: minor(a.amount_spent) ?? 0,
      spendCap: cap && cap > 0 ? cap : null,
      disableReason: a.disable_reason || null,
    } satisfies AccountInfo;
  },

  async totals(id, range) {
    const rows = await graphAll<InsightRow>(`${id}/insights`, insightParams(range), 1);
    return toMetrics(rows[0]);
  },

  async daily(id, range) {
    const rows = await graphAll<InsightRow>(`${id}/insights`, { ...insightParams(range), time_increment: 1 });
    return rows.map((r) => ({ date: r.date_start!, ...toMetrics(r) })) satisfies DailyPoint[];
  },

  async campaigns(id, range) {
    const [campaigns, adsets, metrics] = await Promise.all([
      graphAll<{
        id: string;
        name: string;
        effective_status: string;
        objective: string;
        daily_budget?: string;
        lifetime_budget?: string;
      }>(`${id}/campaigns`, { fields: "id,name,effective_status,objective,daily_budget,lifetime_budget" }),
      graphAll<{ id: string; campaign_id: string; daily_budget?: string; lifetime_budget?: string }>(`${id}/adsets`, {
        fields: "id,campaign_id,daily_budget,lifetime_budget",
      }),
      insightsByLevel(id, range, "campaign"),
    ]);
    return campaigns.map((c) => {
      const own = adsets.filter((s) => s.campaign_id === c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.effective_status,
        objective: c.objective,
        budget: { daily: minor(c.daily_budget), lifetime: minor(c.lifetime_budget) },
        adsetCount: own.length,
        adsetBudgets: own.filter((s) => Number(s.daily_budget) > 0 || Number(s.lifetime_budget) > 0).length,
        metrics: metrics.get(c.id) ?? null,
      } satisfies CampaignRow;
    });
  },

  async adsets(id, range) {
    const [adsets, metrics] = await Promise.all([
      graphAll<{
        id: string;
        name: string;
        campaign_id: string;
        campaign?: { name: string };
        effective_status: string;
        optimization_goal?: string;
        daily_budget?: string;
        lifetime_budget?: string;
      }>(`${id}/adsets`, {
        fields: "id,name,campaign_id,campaign{name},effective_status,optimization_goal,daily_budget,lifetime_budget",
      }),
      insightsByLevel(id, range, "adset"),
    ]);
    return adsets.map(
      (s) =>
        ({
          id: s.id,
          name: s.name,
          campaignId: s.campaign_id,
          campaignName: s.campaign?.name ?? "",
          status: s.effective_status,
          optimizationGoal: s.optimization_goal ?? "",
          budget: { daily: minor(s.daily_budget), lifetime: minor(s.lifetime_budget) },
          metrics: metrics.get(s.id) ?? null,
        }) satisfies AdSetRow,
    );
  },

  async ads(id, range) {
    const [ads, metrics] = await Promise.all([
      graphAll<{
        id: string;
        name: string;
        effective_status: string;
        adset_id: string;
        campaign_id: string;
        adset?: { name: string };
        campaign?: { name: string };
        creative?: { thumbnail_url?: string; title?: string; body?: string };
        ad_review_feedback?: { global?: Record<string, string> };
      }>(`${id}/ads`, {
        fields:
          "id,name,effective_status,adset_id,campaign_id,adset{name},campaign{name},creative{thumbnail_url,title,body},ad_review_feedback",
        limit: 200,
      }),
      insightsByLevel(id, range, "ad"),
    ]);
    return ads.map(
      (a) =>
        ({
          id: a.id,
          name: a.name,
          adsetId: a.adset_id,
          adsetName: a.adset?.name ?? "",
          campaignId: a.campaign_id,
          campaignName: a.campaign?.name ?? "",
          status: a.effective_status,
          thumbnail: a.creative?.thumbnail_url ?? null,
          title: a.creative?.title ?? null,
          body: a.creative?.body ?? null,
          reviewFeedback: a.ad_review_feedback?.global ? Object.values(a.ad_review_feedback.global).join(" ") : null,
          metrics: metrics.get(a.id) ?? null,
        }) satisfies AdRow,
    );
  },

  async disapprovedAds(id) {
    const body = await graphGet<{ summary?: { total_count?: number } }>(`${id}/ads`, {
      effective_status: ["DISAPPROVED"],
      summary: "total_count",
      limit: 0,
    });
    return body.summary?.total_count ?? 0;
  },

  async audiences(id) {
    const [custom, saved] = await Promise.all([
      graphAll<{
        id: string;
        name: string;
        description?: string;
        subtype?: string;
        approximate_count_lower_bound?: number;
        approximate_count_upper_bound?: number;
        delivery_status?: { code: number; description?: string };
        operation_status?: { code: number; description?: string };
        retention_days?: number;
        time_updated?: number;
      }>(`${id}/customaudiences`, {
        fields:
          "id,name,description,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,retention_days,time_updated",
      }),
      graphAll<{ id: string; name: string; description?: string; time_updated?: string }>(`${id}/saved_audiences`, {
        fields: "id,name,description,time_updated",
      }).catch(() => []),
    ]);

    const customRows = custom.map((a): AudienceRow => {
      const lower = a.approximate_count_lower_bound ?? -1;
      const upper = a.approximate_count_upper_bound ?? -1;
      const opText = `${a.operation_status?.description ?? ""} ${a.delivery_status?.description ?? ""}`.toLowerCase();
      const availability =
        a.delivery_status?.code === 200
          ? "Ready"
          : /populat|process|updat/.test(opText)
            ? "Populating"
            : a.delivery_status?.code
              ? "Unavailable"
              : "Ready";
      return {
        id: a.id,
        name: a.name,
        description: a.description ?? "",
        kind: "custom",
        source: sourceFromSubtype(a.subtype),
        availability,
        availabilityNote: a.delivery_status?.code === 200 ? "" : (a.delivery_status?.description ?? ""),
        sizeLower: lower > 0 ? lower : null,
        sizeUpper: upper > 0 ? upper : null,
        retentionDays: a.retention_days ?? null,
        updatedAt: a.time_updated ? new Date(a.time_updated * 1000).toISOString() : null,
      };
    });

    const savedRows = saved.map(
      (a): AudienceRow => ({
        id: a.id,
        name: a.name,
        description: a.description ?? "",
        kind: "saved",
        source: "Saved targeting",
        availability: "Accessible",
        availabilityNote: "",
        sizeLower: null,
        sizeUpper: null,
        retentionDays: null,
        updatedAt: a.time_updated ?? null,
      }),
    );

    return [...customRows, ...savedRows];
  },

  async leads(id, range) {
    // Leads live on each ad; only query ads that reported leads in the range.
    const metrics = await insightsByLevel(id, range, "ad");
    const adIds = [...metrics.entries()]
      .filter(([, m]) => m.leads > 0)
      .sort((a, b) => b[1].leads - a[1].leads)
      .slice(0, 40)
      .map(([adId]) => adId);

    const since = Math.floor(new Date(`${range.since}T00:00:00Z`).getTime() / 1000) - 86_400;
    const until = Math.floor(new Date(`${range.until}T23:59:59Z`).getTime() / 1000) + 86_400;

    const results = await Promise.all(
      adIds.map((adId) =>
        graphAll<{
          id: string;
          created_time: string;
          ad_id?: string;
          ad_name?: string;
          campaign_name?: string;
          form_id?: string;
          field_data?: { name: string; values: string[] }[];
        }>(
          `${adId}/leads`,
          {
            fields: "id,created_time,ad_id,ad_name,campaign_name,form_id,field_data",
            filtering: [
              { field: "time_created", operator: "GREATER_THAN", value: since },
              { field: "time_created", operator: "LESS_THAN", value: until },
            ],
          },
          5,
        ),
      ),
    );

    return results
      .flat()
      .map(
        (l): LeadRow => ({
          id: l.id,
          createdTime: l.created_time,
          adId: l.ad_id ?? "",
          adName: l.ad_name ?? "",
          campaignName: l.campaign_name ?? "",
          formId: l.form_id ?? "",
          fields: l.field_data ?? [],
        }),
      )
      .sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  },

  async accessibleAccounts() {
    const rows = await graphAll<{ id: string; name: string; currency: string; account_status: number; business?: { name: string } }>(
      "me/adaccounts",
      { fields: "id,name,currency,account_status,business{name}" },
    );
    return rows.map(
      (a): AccessibleAccount => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        status: mapStatus(a.account_status),
        business: a.business?.name ?? null,
      }),
    );
  },
};
