"use client";

import { useState } from "react";

import type {
  KarmicEthicsCheckin,
  KarmicEthicsPrinciple,
  KarmicPartner,
  KarmicPartnerAction,
  SixTimeNightlyReview,
} from "@pm/types";
import { ReadingsModal } from "@/components/six-time/ReadingsModal";
import { DailyLogTab } from "./DailyLogTab";
import { PartnersTab } from "./PartnersTab";
import { EthicsTab } from "./EthicsTab";

type TabId = "log" | "partners" | "ethics";

const TABS: { id: TabId; label: string; title: string; subtitle: string }[] = [
  {
    id: "log",
    label: "Daily Log",
    title: "Nightly Review",
    subtitle: "Before sleep — your best and worst of the day, free of judgment.",
  },
  {
    id: "partners",
    label: "Karmic Partners",
    title: "Karmic Partners",
    subtitle: "Make your four partners successful first — your own success is the echo.",
  },
  {
    id: "ethics",
    label: "Ethics Code",
    title: "Personal Ethical Code",
    subtitle: "The one karma that decides the thoughts you hear all day — keep it, check it nightly.",
  },
];

export function KarmicHub({
  today,
  reviews,
  partners,
  partnerActions,
  principles,
  checkins,
}: {
  today: string;
  reviews: SixTimeNightlyReview[];
  partners: KarmicPartner[];
  partnerActions: KarmicPartnerAction[];
  principles: KarmicEthicsPrinciple[];
  checkins: KarmicEthicsCheckin[];
}) {
  const [tab, setTab] = useState<TabId>("log");
  const [showReading, setShowReading] = useState(false);
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-indigo-50/40 to-transparent">
      <header className="border-b border-blue-100 bg-white/60 px-6 py-5 backdrop-blur md:px-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
              Karmic Management
            </p>
            {/* Show the active tab's own title + subtitle at the top. */}
            <h1 className="mt-0.5 font-handwriting text-2xl text-ink">{active.title}</h1>
            <p className="mt-0.5 text-xs text-ink-light">{active.subtitle}</p>
          </div>
          <button
            onClick={() => setShowReading(true)}
            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            📖 Daily reading
          </button>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex w-fit gap-1 rounded-lg border border-blue-100 bg-white p-0.5 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                tab === t.id ? "bg-indigo-600 text-white" : "text-ink-light hover:bg-blue-50"
              }`}
              aria-pressed={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
        <div className="mx-auto max-w-3xl">
          {tab === "log" && <DailyLogTab today={today} reviews={reviews} />}
          {tab === "partners" && (
            <PartnersTab today={today} partners={partners} actions={partnerActions} />
          )}
          {tab === "ethics" && (
            <EthicsTab today={today} principles={principles} checkins={checkins} />
          )}
        </div>
      </div>

      {showReading && <ReadingsModal onClose={() => setShowReading(false)} />}
    </div>
  );
}
