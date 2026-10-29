import type { DateRange } from "@/lib/dates";

/** Additive metrics. Ratios (ROAS, CPA, CTR…) are always derived from these, never summed. */
export type Metrics = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  leads: number;
};

export type DailyPoint = Metrics & { date: string };

export type AccountStatus = "ACTIVE" | "DISABLED" | "UNSETTLED" | "PENDING" | "CLOSED" | "OTHER";

export type AccountInfo = {
  id: string;
  name: string;
  status: AccountStatus;
  currency: string;
  timezone: string;
  business: string | null;
  amountSpent: number;
  spendCap: number | null;
  disableReason: number | null;
};

export type Budget = { daily: number | null; lifetime: number | null };

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget: Budget;
  adsetCount: number;
  adsetBudgets: number;
  metrics: Metrics | null;
};

export type AdSetRow = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  optimizationGoal: string;
  budget: Budget;
  metrics: Metrics | null;
};

export type AdRow = {
  id: string;
  name: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  thumbnail: string | null;
  title: string | null;
  body: string | null;
  reviewFeedback: string | null;
  metrics: Metrics | null;
};

export type AudienceAvailability = "Ready" | "Populating" | "Accessible" | "Unavailable";

export type AudienceRow = {
  id: string;
  name: string;
  description: string;
  kind: "custom" | "saved";
  source: string;
  availability: AudienceAvailability;
  availabilityNote: string;
  sizeLower: number | null;
  sizeUpper: number | null;
  retentionDays: number | null;
  updatedAt: string | null;
};

export type LeadRow = {
  id: string;
  createdTime: string;
  adId: string;
  adName: string;
  campaignName: string;
  formId: string;
  fields: { name: string; values: string[] }[];
};

export type AccessibleAccount = { id: string; name: string; currency: string; status: AccountStatus; business: string | null };

export interface MetaProvider {
  account(id: string): Promise<AccountInfo>;
  totals(id: string, range: DateRange): Promise<Metrics>;
  daily(id: string, range: DateRange): Promise<DailyPoint[]>;
  campaigns(id: string, range: DateRange): Promise<CampaignRow[]>;
  adsets(id: string, range: DateRange): Promise<AdSetRow[]>;
  ads(id: string, range: DateRange): Promise<AdRow[]>;
  disapprovedAds(id: string): Promise<number>;
  audiences(id: string): Promise<AudienceRow[]>;
  leads(id: string, range: DateRange): Promise<LeadRow[]>;
  accessibleAccounts(): Promise<AccessibleAccount[]>;
}
