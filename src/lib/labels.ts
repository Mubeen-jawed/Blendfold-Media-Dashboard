import { money } from "@/lib/format";
import type { Budget } from "@/lib/meta/types";

const OBJECTIVES: Record<string, string> = {
  OUTCOME_SALES: "Sales",
  OUTCOME_LEADS: "Leads",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "App promotion",
  CONVERSIONS: "Sales",
  PRODUCT_CATALOG_SALES: "Sales",
  LEAD_GENERATION: "Leads",
  LINK_CLICKS: "Traffic",
  REACH: "Awareness",
  BRAND_AWARENESS: "Awareness",
  VIDEO_VIEWS: "Engagement",
  POST_ENGAGEMENT: "Engagement",
  MESSAGES: "Engagement",
  APP_INSTALLS: "App promotion",
};

export function objectiveLabel(o: string) {
  return OBJECTIVES[o] ?? humanize(o);
}

export function humanize(s: string) {
  if (!s) return "";
  const t = s.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function budgetLabel(b: Budget, currency: string, level: "Campaign" | "Ad set", childBudgets = 0): [string, string] {
  if (b.daily) return [`${money(b.daily, currency, 2)} / day`, `${level} daily`];
  if (b.lifetime) return [`${money(b.lifetime, currency, 2)} total`, `${level} lifetime`];
  if (level === "Campaign") return ["At ad set level", childBudgets ? `${childBudgets} ad set budget${childBudgets === 1 ? "" : "s"}` : "Ad set budgets"];
  return ["Campaign budget", "Shared"];
}
