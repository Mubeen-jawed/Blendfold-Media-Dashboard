"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
} from "recharts";
import type { DailyPoint, Metrics } from "@/lib/meta/types";
import { addMetrics, derive, RESULT_LABEL, type ResultMode } from "@/lib/metrics";
import { compactMoney, money, multiple, num } from "@/lib/format";
import { shortDate } from "@/lib/dates";
import { Popover } from "./filters";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const C = {
  spend: "#45648d",
  secondary: "#6f9a80",
  prev: "#c3cbd6",
  grid: "#eef0f3",
  axis: "#667085",
  bar: "#c8d6e5",
};

type Series = "roas" | "results" | "cost";

function secondaryValue(m: Metrics, series: Series, mode: ResultMode) {
  if (series === "roas") return derive.roas(m);
  if (series === "results") return mode === "leads" ? m.leads : m.purchases;
  return mode === "leads" ? derive.cpl(m) : derive.cpa(m);
}

function formatSecondary(v: number | null, series: Series, currency: string) {
  if (v == null) return "—";
  if (series === "roas") return multiple(v);
  if (series === "results") return num(v);
  return money(v, currency, 2);
}

function groupWeekly(points: DailyPoint[]) {
  const out: DailyPoint[] = [];
  points.forEach((p, i) => {
    if (i % 7 === 0) out.push({ ...p });
    else {
      const last = out[out.length - 1];
      Object.assign(last, addMetrics(last, p));
    }
  });
  return out;
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const current = options.find((o) => o.value === value)!;
  return (
    <Popover
      align="right"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="btn h-10">
          <ChevronDown className="size-4 text-muted" />
          {current.label}
        </button>
      )}
    >
      {(close) => (
        <div className="w-[200px]">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => (onChange(o.value), close())}
              className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sunken", o.value === value ? "text-brand-ink" : "text-ink-2")}
            >
              {o.label}
              {o.value === value && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function PerformanceChart({
  daily,
  prevDaily,
  mode,
  currency,
  subtitle,
}: {
  daily: DailyPoint[];
  prevDaily: DailyPoint[];
  mode: ResultMode;
  currency: string;
  subtitle: string;
}) {
  const [series, setSeries] = useState<Series>(mode === "leads" ? "cost" : "roas");
  const [interval, setInterval] = useState<"daily" | "weekly">(daily.length > 45 ? "weekly" : "daily");
  const labels = RESULT_LABEL[mode];
  const seriesName = series === "roas" ? "Attributed purchase ROAS" : series === "results" ? labels.many : labels.cost;

  const data = useMemo(() => {
    const cur = interval === "weekly" ? groupWeekly(daily) : daily;
    const prev = interval === "weekly" ? groupWeekly(prevDaily) : prevDaily;
    return cur.map((p, i) => ({
      date: p.date,
      spend: p.spend,
      prevSpend: prev[i]?.spend ?? null,
      secondary: secondaryValue(p, series, mode),
    }));
  }, [daily, prevDaily, interval, series, mode]);

  const hasData = data.some((d) => d.spend > 0);
  const tickEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Performance over time</h2>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Toggle
            value={series}
            onChange={setSeries}
            options={[
              { value: "roas", label: "Spend + ROAS" },
              { value: "results", label: `Spend + ${labels.many}` },
              { value: "cost", label: `Spend + ${labels.costShort.replace(" / ", " per ")}` },
            ]}
          />
          <Toggle
            value={interval}
            onChange={setInterval}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 pt-4 text-[13px] text-ink-2 sm:px-6">
        <LegendSwatch color={C.spend} label="Spend" />
        <LegendSwatch color={C.secondary} label={seriesName} />
        <LegendSwatch color={C.prev} label="Previous period" dashed />
      </div>
      <div className="h-[230px] px-2 pt-2 sm:h-[260px] sm:px-3">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.spend} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={C.spend} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                interval={tickEvery - 1}
                tick={{ fontSize: 12, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                yAxisId="spend"
                tickFormatter={(v) => compactMoney(v, currency)}
                tick={{ fontSize: 12, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <YAxis
                yAxisId="secondary"
                orientation="right"
                tickFormatter={(v) => (series === "roas" ? `${v}×` : series === "cost" ? compactMoney(v, currency) : num(v))}
                tick={{ fontSize: 12, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: C.prev }}
                contentStyle={{ borderRadius: 12, border: "1px solid #e4e7ec", fontSize: 13, boxShadow: "0 8px 24px rgba(16,24,40,.08)" }}
                labelFormatter={(d) => shortDate(String(d))}
                formatter={(v: number, name: string) => {
                  if (name === "secondary") return [formatSecondary(v, series, currency), seriesName];
                  return [money(v, currency), name === "prevSpend" ? "Previous period spend" : "Spend"];
                }}
              />
              <Area yAxisId="spend" type="linear" dataKey="spend" stroke="none" fill="url(#spendFill)" />
              <Line yAxisId="spend" type="linear" dataKey="prevSpend" stroke={C.prev} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              <Line yAxisId="secondary" type="linear" dataKey="secondary" stroke={C.secondary} strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="spend" type="linear" dataKey="spend" stroke={C.spend} strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">No delivery in this period.</div>
        )}
      </div>
    </>
  );
}

function LegendSwatch({ color, label, dashed, bar }: { color: string; label: string; dashed?: boolean; bar?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {bar ? (
        <span className="size-2.5 rounded-sm" style={{ background: color }} />
      ) : (
        <span className="h-0 w-4" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} />
      )}
      {label}
    </span>
  );
}

export function SpendReturnChart({
  buckets,
  mode,
  currency,
}: {
  buckets: { label: string; spend: number; secondary: number | null }[];
  mode: ResultMode;
  currency: string;
}) {
  const secondaryName = mode === "leads" ? "Cost per lead" : "Purchase ROAS";
  const showLabels = buckets.length <= 8;
  return (
    <>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 pt-1 text-[13px] text-ink-2 sm:px-6">
        <LegendSwatch color={C.bar} label="Amount spent" bar />
        <LegendSwatch color={C.secondary} label={secondaryName} />
        <span className="text-xs text-muted">Left axis: {currency} · Right axis: {mode === "leads" ? currency : "return"}</span>
      </div>
      <div className="h-[260px] px-2 pt-3 sm:px-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={buckets} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.axis }} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
            <YAxis yAxisId="spend" tickFormatter={(v) => compactMoney(v, currency)} tick={{ fontSize: 12, fill: C.axis }} axisLine={false} tickLine={false} width={52} />
            <YAxis
              yAxisId="secondary"
              orientation="right"
              tickFormatter={(v) => (mode === "leads" ? compactMoney(v, currency) : `${v}×`)}
              tick={{ fontSize: 12, fill: C.axis }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "#f2f4f7" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e4e7ec", fontSize: 13 }}
              formatter={(v: number, name: string) =>
                name === "spend" ? [money(v, currency), "Amount spent"] : [mode === "leads" ? money(v, currency, 2) : multiple(v), secondaryName]
              }
            />
            <Bar yAxisId="spend" dataKey="spend" fill={C.bar} radius={[4, 4, 0, 0]} maxBarSize={88}>
              {showLabels && <LabelList dataKey="spend" position="top" formatter={(v: number) => money(v, currency, 0)} style={{ fontSize: 12, fill: "#1d2939" }} />}
            </Bar>
            <Line
              yAxisId="secondary"
              type="linear"
              dataKey="secondary"
              stroke={C.secondary}
              strokeWidth={2}
              dot={{ r: 4, fill: "#fff", stroke: C.secondary, strokeWidth: 1.5 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** Stacked horizontal share bar (CSS only). */
export function ShareBar({ items }: { items: { label: string; value: number }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const palette = ["#45648d", "#5a7aa3", "#6f9a80", "#a9bfb1", "#b8c7da", "#dde3ea", "#cfd6df", "#e8ecf0"];
  return (
    <div className="flex h-3 w-full gap-1 overflow-hidden rounded-sm">
      {items.map((it, i) => (
        <span key={it.label + i} title={`${it.label}: ${((it.value / total) * 100).toFixed(1)}%`} style={{ width: `${(it.value / total) * 100}%`, background: palette[i % palette.length] }} className="h-full min-w-[3px] rounded-sm" />
      ))}
    </div>
  );
}
