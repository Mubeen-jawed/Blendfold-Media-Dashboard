const numberFmt = new Intl.NumberFormat("en-US");

export function money(value: number | null | undefined, currency = "USD", digits?: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const fractionDigits = digits ?? (Math.abs(value) >= 1000 ? 0 : 2);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function compactMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function num(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return numberFmt.format(Math.round(value));
}

export function pct(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function multiple(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}×`;
}

/** Relative change in percent, or null when there is no baseline. */
export function change(current: number | null, previous: number | null) {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function initials(name: string) {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function idEnding(metaId: string) {
  return metaId.replace(/^act_/, "").slice(-4);
}

/** "Oct 28, 2026 · 9:41 AM" */
export function fetchedLabel(ts: number) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}
