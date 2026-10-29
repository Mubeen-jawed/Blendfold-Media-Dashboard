import "server-only";
import { createHmac } from "node:crypto";

const GRAPH = "https://graph.facebook.com";

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

type Params = Record<string, string | number | boolean | object | undefined>;

function token() {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new MetaApiError("META_ACCESS_TOKEN is not configured.");
  return t;
}

function buildUrl(path: string, params: Params) {
  const version = process.env.META_API_VERSION || "v23.0";
  const url = new URL(`${GRAPH}/${version}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const accessToken = token();
  url.searchParams.set("access_token", accessToken);
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) url.searchParams.set("appsecret_proof", createHmac("sha256", appSecret).update(accessToken).digest("hex"));
  return url.toString();
}

async function request<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const err = body.error ?? {};
    // 1, 2, 4, 17, 32, 613: transient / rate-limit errors worth one retry
    if ([1, 2, 4, 17, 32, 613].includes(err.code) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return request<T>(url, attempt + 1);
    }
    throw new MetaApiError(err.error_user_msg || err.message || `Meta API request failed (${res.status})`, err.code, err.error_subcode);
  }
  return body as T;
}

export async function graphGet<T>(path: string, params: Params = {}): Promise<T> {
  return request<T>(buildUrl(path, params));
}

/** Fetches every page of an edge (bounded by maxPages). */
export async function graphAll<T>(path: string, params: Params = {}, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = buildUrl(path, { limit: 500, ...params });
  for (let page = 0; next && page < maxPages; page++) {
    const body: { data?: T[]; paging?: { next?: string } } = await request(next);
    out.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return out;
}
