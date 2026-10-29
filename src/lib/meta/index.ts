import "server-only";
import { unstable_cache } from "next/cache";
import { liveProvider } from "./live";
import { mockProvider } from "./mock";
import type { MetaProvider } from "./types";

export const META_CACHE_TAG = "meta";

export function isMockMode() {
  return process.env.META_MOCK === "true" || !process.env.META_ACCESS_TOKEN;
}

const ttl = Number(process.env.META_CACHE_SECONDS) || 900;

export type Fetched<T> = { data: T; fetchedAt: number };

/**
 * Every Meta read goes through Next's data cache so page loads don't hit the API
 * (and its rate limits) more than once per META_CACHE_SECONDS per query.
 */
function cached<K extends keyof MetaProvider>(method: K) {
  type Fn = MetaProvider[K];
  return unstable_cache(
    async (...args: Parameters<Fn>): Promise<Fetched<Awaited<ReturnType<Fn>>>> => {
      const provider = isMockMode() ? mockProvider : liveProvider;
      const fn = provider[method] as (...a: Parameters<Fn>) => ReturnType<Fn>;
      return { data: (await fn(...args)) as Awaited<ReturnType<Fn>>, fetchedAt: Date.now() };
    },
    ["meta", method, isMockMode() ? "mock" : "live"],
    { revalidate: ttl, tags: [META_CACHE_TAG] },
  );
}

export const meta = {
  account: cached("account"),
  totals: cached("totals"),
  daily: cached("daily"),
  campaigns: cached("campaigns"),
  adsets: cached("adsets"),
  ads: cached("ads"),
  disapprovedAds: cached("disapprovedAds"),
  audiences: cached("audiences"),
  leads: cached("leads"),
  accessibleAccounts: cached("accessibleAccounts"),
};

/** Normalises "123", "act_123" or an Ads Manager URL to "act_123". */
export function normalizeAccountId(input: string) {
  const digits = input.match(/(?:act[_=])?(\d{5,})/)?.[1];
  return digits ? `act_${digits}` : null;
}

export function adsManagerUrl(metaId?: string) {
  if (!metaId) return "https://adsmanager.facebook.com/adsmanager/manage/campaigns";
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaId.replace(/^act_/, "")}`;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Unknown error";
}
