import "server-only";
import { eachDay, parseISO, type DateRange } from "@/lib/dates";
import { sumMetrics } from "@/lib/metrics";
import type { AdRow, AdSetRow, AudienceRow, CampaignRow, DailyPoint, LeadRow, MetaProvider, Metrics } from "./types";

// Deterministic sample data so the dashboard is usable without a Meta token (META_MOCK=true).

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function profile(id: string) {
  const r = (k: string) => hash(`${id}:${k}`);
  return {
    baseSpend: 120 + r("spend") * 900,
    leadGen: r("mode") > 0.55,
    cpa: 25 + r("cpa") * 40,
    cpl: 18 + r("cpl") * 50,
    aov: 120 + r("aov") * 140,
    ctr: 0.012 + r("ctr") * 0.012,
    cpm: 9 + r("cpm") * 12,
    trend: (r("trend") - 0.35) * 0.012,
    disabled: r("status") > 0.82,
  };
}

function dayMetrics(id: string, date: string): Metrics {
  const p = profile(id);
  const dayIndex = (parseISO(date).getTime() - parseISO("2026-01-01").getTime()) / 86_400_000;
  const wave = 1 + 0.18 * Math.sin(dayIndex / 3.1) + (hash(`${id}:${date}`) - 0.5) * 0.35;
  const spend = Math.max(0, p.baseSpend * wave * (1 + p.trend * (dayIndex % 120)));
  const impressions = (spend / p.cpm) * 1000;
  const linkClicks = impressions * p.ctr;
  const q = hash(`${id}:${date}:q`);
  const purchases = p.leadGen ? 0 : Math.round((spend / p.cpa) * (0.75 + q * 0.5));
  const leads = p.leadGen ? Math.round((spend / p.cpl) * (0.75 + q * 0.5)) : 0;
  return {
    spend: Math.round(spend * 100) / 100,
    impressions: Math.round(impressions),
    reach: Math.round(impressions / 1.6),
    clicks: Math.round(linkClicks * 1.4),
    linkClicks: Math.round(linkClicks),
    purchases,
    purchaseValue: Math.round(purchases * p.aov * (0.85 + q * 0.3)),
    leads,
  };
}

const scale = (m: Metrics, f: number): Metrics => ({
  spend: Math.round(m.spend * f * 100) / 100,
  impressions: Math.round(m.impressions * f),
  reach: Math.round(m.reach * f),
  clicks: Math.round(m.clicks * f),
  linkClicks: Math.round(m.linkClicks * f),
  purchases: Math.round(m.purchases * f),
  purchaseValue: Math.round(m.purchaseValue * f),
  leads: Math.round(m.leads * f),
});

type CampaignDef = { name: string; objective: string; status: string; weight: number; daily?: number; lifetime?: number; adsets: number };

const CAMPAIGNS: CampaignDef[] = [
  { name: "Evergreen · Advantage+ shopping", objective: "OUTCOME_SALES", status: "ACTIVE", weight: 0.45, daily: 500, adsets: 4 },
  { name: "Core collection · Prospecting", objective: "OUTCOME_SALES", status: "ACTIVE", weight: 0.23, daily: 300, adsets: 3 },
  { name: "Returning customers · Retargeting", objective: "OUTCOME_SALES", status: "ACTIVE", weight: 0.17, daily: 200, adsets: 2 },
  { name: "Autumn essentials · Product sets", objective: "OUTCOME_SALES", status: "PAUSED", weight: 0.1, lifetime: 3000, adsets: 2 },
  { name: "Creative exploration · New angles", objective: "OUTCOME_SALES", status: "PAUSED", weight: 0.05, adsets: 2 },
  { name: "Holiday launch · Early access", objective: "OUTCOME_AWARENESS", status: "PAUSED", weight: 0, daily: 350, adsets: 1 },
];
const LEAD_CAMPAIGNS: CampaignDef[] = [
  { name: "Lead gen · Instant form · Broad", objective: "OUTCOME_LEADS", status: "ACTIVE", weight: 0.5, daily: 250, adsets: 3 },
  { name: "Lead gen · Retargeting", objective: "OUTCOME_LEADS", status: "ACTIVE", weight: 0.3, daily: 120, adsets: 2 },
  { name: "Spanish creative test", objective: "OUTCOME_LEADS", status: "ACTIVE", weight: 0.2, adsets: 2 },
  { name: "Awareness · Local video", objective: "OUTCOME_AWARENESS", status: "PAUSED", weight: 0, daily: 80, adsets: 1 },
];

function campaignDefs(id: string) {
  return profile(id).leadGen ? LEAD_CAMPAIGNS : CAMPAIGNS;
}

const num = (id: string) => id.replace(/^act_/, "");

function totals(id: string, range: DateRange) {
  return sumMetrics(eachDay(range).map((d) => dayMetrics(id, d)));
}

function buildCampaigns(id: string, range: DateRange): CampaignRow[] {
  const t = totals(id, range);
  return campaignDefs(id).map((c, i) => ({
    id: `${num(id).slice(0, 6)}${1042 + i * 7}`,
    name: c.name,
    status: c.status,
    objective: c.objective,
    budget: { daily: c.daily ?? null, lifetime: c.lifetime ?? null },
    adsetCount: c.adsets,
    adsetBudgets: c.daily || c.lifetime ? 0 : c.adsets,
    metrics: c.weight > 0 ? scale(t, c.weight) : null,
  }));
}

function buildAdsets(id: string, range: DateRange): AdSetRow[] {
  const leadGen = profile(id).leadGen;
  return buildCampaigns(id, range).flatMap((c) =>
    Array.from({ length: c.adsetCount }, (_, i) => {
      const share = c.adsetCount === 1 ? 1 : i === 0 ? 0.45 : 0.55 / (c.adsetCount - 1);
      return {
        id: `${c.id}${i + 1}`,
        name: ["Broad · 25–65+", "Interest stack", "Lookalike 1%", "Retargeting · 30d"][i % 4],
        campaignId: c.id,
        campaignName: c.name,
        status: c.status,
        optimizationGoal: leadGen ? "LEAD_GENERATION" : "OFFSITE_CONVERSIONS",
        budget: c.budget.daily || c.budget.lifetime ? { daily: null, lifetime: null } : { daily: 60, lifetime: null },
        metrics: c.metrics ? scale(c.metrics, share) : null,
      };
    }),
  );
}

function buildAds(id: string, range: DateRange): AdRow[] {
  return buildAdsets(id, range).flatMap((s) =>
    [0, 1].map((i) => ({
      id: `${s.id}0${i}`,
      name: i === 0 ? "Video · UGC hook" : "Static · Offer card",
      adsetId: s.id,
      adsetName: s.name,
      campaignId: s.campaignId,
      campaignName: s.campaignName,
      status: hash(`${s.id}${i}:dis`) > 0.93 ? "DISAPPROVED" : s.status,
      thumbnail: null,
      title: i === 0 ? "See why customers switch" : "Limited-time offer",
      body: "Sample creative copy for preview purposes.",
      reviewFeedback: null,
      metrics: s.metrics ? scale(s.metrics, i === 0 ? 0.62 : 0.38) : null,
    })),
  );
}

export const mockProvider: MetaProvider = {
  async account(id) {
    const p = profile(id);
    return {
      id,
      name: `Sample account ${num(id).slice(-4)}`,
      status: p.disabled ? "DISABLED" : "ACTIVE",
      currency: "USD",
      timezone: "America/Los_Angeles",
      business: null,
      amountSpent: Math.round(p.baseSpend * 400),
      spendCap: hash(`${id}:cap`) > 0.85 ? Math.round(p.baseSpend * 400) : null,
      disableReason: p.disabled ? 1 : null,
    };
  },
  async totals(id, range) {
    return totals(id, range);
  },
  async daily(id, range): Promise<DailyPoint[]> {
    return eachDay(range).map((date) => ({ date, ...dayMetrics(id, date) }));
  },
  async campaigns(id, range) {
    return buildCampaigns(id, range);
  },
  async adsets(id, range) {
    return buildAdsets(id, range);
  },
  async ads(id, range) {
    return buildAds(id, range);
  },
  async disapprovedAds(id) {
    return hash(`${id}:disapproved`) > 0.8 ? 3 : 0;
  },
  async audiences(id) {
    const n = num(id).slice(-4);
    const rows: AudienceRow[] = [
      {
        id: `${n}7004`,
        name: "Website visitors · 30 days",
        description: "People who visited the website in the last 30 days.",
        kind: "custom",
        source: "Website",
        availability: "Ready",
        availabilityNote: "",
        sizeLower: 24000,
        sizeUpper: 29000,
        retentionDays: 30,
        updatedAt: null,
      },
      {
        id: `${n}7011`,
        name: "Past customers · Customer list",
        description: "Uploaded customer list for returning-customer campaigns.",
        kind: "custom",
        source: "Customer list",
        availability: hash(`${id}:pop`) > 0.6 ? "Populating" : "Ready",
        availabilityNote: "",
        sizeLower: 6100,
        sizeUpper: 7200,
        retentionDays: null,
        updatedAt: null,
      },
      {
        id: `${n}7020`,
        name: "Broad prospecting · US",
        description: "Saved broad targeting definition for US campaigns.",
        kind: "saved",
        source: "Saved targeting",
        availability: "Accessible",
        availabilityNote: "",
        sizeLower: null,
        sizeUpper: null,
        retentionDays: null,
        updatedAt: null,
      },
    ];
    return rows;
  },
  async leads(id, range) {
    if (!profile(id).leadGen) return [];
    const days = eachDay(range).slice(-10);
    const names = ["Maria Lopez", "James Carter", "Priya Shah", "Daniel Kim", "Sofia Garcia", "Ethan Brooks"];
    return days.flatMap((d, i): LeadRow[] =>
      [0, 1].map((j) => {
        const name = names[(i + j) % names.length];
        return {
          id: `${num(id)}${i}${j}`,
          createdTime: `${d}T${String(9 + j * 5).padStart(2, "0")}:2${i % 10}:00+0000`,
          adId: "",
          adName: j === 0 ? "Video · UGC hook" : "Static · Offer card",
          campaignName: LEAD_CAMPAIGNS[j].name,
          formId: "1001",
          fields: [
            { name: "full_name", values: [name] },
            { name: "email", values: [`${name.split(" ")[0].toLowerCase()}@example.com`] },
            { name: "phone_number", values: [`+1 555 01${String(i).padStart(2, "0")}`] },
            { name: "zip_code", values: [String(90000 + i * 37)] },
          ],
        };
      }),
    );
  },
  async accessibleAccounts() {
    return [];
  },
};
