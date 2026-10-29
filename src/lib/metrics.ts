import type { Metrics } from "@/lib/meta/types";

export const EMPTY_METRICS: Metrics = {
  spend: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  linkClicks: 0,
  purchases: 0,
  purchaseValue: 0,
  leads: 0,
};

export function addMetrics(a: Metrics, b: Metrics): Metrics {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    // Reach is not additive across accounts/days; the sum is an upper bound.
    reach: a.reach + b.reach,
    clicks: a.clicks + b.clicks,
    linkClicks: a.linkClicks + b.linkClicks,
    purchases: a.purchases + b.purchases,
    purchaseValue: a.purchaseValue + b.purchaseValue,
    leads: a.leads + b.leads,
  };
}

export function sumMetrics(list: Metrics[]) {
  return list.reduce(addMetrics, { ...EMPTY_METRICS });
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export const derive = {
  roas: (m: Metrics) => ratio(m.purchaseValue, m.spend),
  cpa: (m: Metrics) => ratio(m.spend, m.purchases),
  cpl: (m: Metrics) => ratio(m.spend, m.leads),
  ctr: (m: Metrics) => (m.impressions > 0 ? (m.linkClicks / m.impressions) * 100 : null),
  cpc: (m: Metrics) => ratio(m.spend, m.linkClicks),
  cpm: (m: Metrics) => (m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null),
  frequency: (m: Metrics) => ratio(m.impressions, m.reach),
};

/** Which conversion the dashboard leads with. "auto" picks whichever the data has more of. */
export type ResultMode = "purchases" | "leads";

export function resolveResultMode(param: string | undefined, totals: Metrics): ResultMode {
  if (param === "purchases" || param === "leads") return param;
  return totals.leads > totals.purchases ? "leads" : "purchases";
}

export function resultCount(m: Metrics, mode: ResultMode) {
  return mode === "leads" ? m.leads : m.purchases;
}

export function costPerResult(m: Metrics, mode: ResultMode) {
  return mode === "leads" ? derive.cpl(m) : derive.cpa(m);
}

export const RESULT_LABEL: Record<ResultMode, { one: string; many: string; cost: string; costShort: string }> = {
  purchases: { one: "Purchase", many: "Purchases", cost: "Cost per purchase", costShort: "Cost / purchase" },
  leads: { one: "Lead", many: "Leads", cost: "Cost per lead", costShort: "Cost / lead" },
};
