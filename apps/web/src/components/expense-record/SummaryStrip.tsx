"use client";

import { formatExpenseAmount } from "@pm/domain";

// ---------------------------------------------------------------------------

interface Props {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  currency: string;
}

// ---------------------------------------------------------------------------

export function SummaryStrip({ todayTotal, weekTotal, monthTotal, currency }: Props) {
  const items = [
    { label: "Today", value: todayTotal },
    { label: "This week", value: weekTotal },
    { label: "This month", value: monthTotal },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-center shadow-sm"
        >
          <p className="text-xs text-ink-light mb-1">{label}</p>
          <p className="font-handwriting text-xl text-ink">{formatExpenseAmount(value, currency)}</p>
        </div>
      ))}
    </div>
  );
}
