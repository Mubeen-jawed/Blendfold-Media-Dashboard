import { Suspense } from "react";
import type { AccountRef } from "@/lib/access";
import { formatRange, type DateRange } from "@/lib/dates";
import { fetchedLabel } from "@/lib/format";
import { AccountPicker, AddFilter, DateRangePicker } from "./filters";

export function FilterBar({
  accounts,
  accountId,
  clientId,
  range,
  note,
  fetchedAt,
  compareLabel,
  allowAll = true,
  showResult = true,
  result,
  right,
}: {
  accounts: AccountRef[];
  accountId?: string;
  clientId?: string;
  range?: DateRange & { preset: string };
  note?: string;
  fetchedAt?: number;
  compareLabel?: string;
  allowAll?: boolean;
  showResult?: boolean;
  result?: string;
  right?: React.ReactNode;
}) {
  const clients = [...new Map(accounts.map((a) => [a.clientId, { id: a.clientId, name: a.clientName }])).values()];
  const pickable = clientId ? accounts.filter((a) => a.clientId === clientId) : accounts;
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <AccountPicker accounts={pickable} value={accountId} allowAll={allowAll} />
          {(clients.length > 1 || showResult) && <AddFilter clients={clients} clientId={clientId} showResult={showResult} result={result} />}
        </Suspense>
        {note && <span className="text-[13px] text-muted">{note}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {fetchedAt && (
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <span className="size-1.5 rounded-full bg-good" />
            Last fetched {fetchedLabel(fetchedAt)}
          </span>
        )}
        {right}
        {range && (
          <Suspense>
            <DateRangePicker label={formatRange(range)} preset={range.preset} since={range.since} until={range.until} />
          </Suspense>
        )}
        {compareLabel && <span className="text-[13px] text-muted">{compareLabel}</span>}
      </div>
    </div>
  );
}
