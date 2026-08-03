// Karmic Management — two practices from the book layered on top of the Nightly Review:
//   KM Rule #3  — make your four karmic business partners successful (a daily action for each).
//   7-Point #3  — keep a personal ethical code, checked each night (kept / slipped + note).

/** The four fixed karmic-business-partner groups (KM Rule #3). */
export type KarmicPartnerGroup = "coworkers" | "customers" | "suppliers" | "world";

export type KarmicPartnerStatus = "active" | "retired";

/** One partner: who they are + what their success looks like. A group holds several. */
export interface KarmicPartner {
  id: string;
  user_id: string;
  partner_group: KarmicPartnerGroup;
  name: string | null; // who — free text (may later link to a Contact)
  success_vision: string | null; // what their success will look like
  status: KarmicPartnerStatus; // retire without deleting history
  sort_order: number; // ordering within the group
  created_at: string;
  updated_at: string;
}

/** A single daily action: something concrete I'll do to make one partner succeed. */
export interface KarmicPartnerAction {
  id: string;
  user_id: string;
  partner_id: string; // FK → karmic_partners — the specific person
  partner_group: KarmicPartnerGroup; // denormalised for cheap history grouping
  action_date: string; // ISO date YYYY-MM-DD
  text: string;
  done: boolean;
  created_at: string;
  updated_at: string;
}

/** One line of the user's personal ethical code (ordered, editable, seeded with defaults). */
export interface KarmicEthicsPrinciple {
  id: string;
  user_id: string;
  label: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** The nightly per-principle check: did I keep it today? One row per (day, principle). */
export interface KarmicEthicsCheckin {
  id: string;
  user_id: string;
  checkin_date: string; // ISO date YYYY-MM-DD
  principle_id: string; // FK → karmic_ethics_principles
  kept: boolean; // true = kept, false = slipped
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Display metadata for the four partner groups, in book order. */
export const KARMIC_PARTNER_GROUPS: {
  group: KarmicPartnerGroup;
  label: string;
  emoji: string;
  hint: string;
  singular: string; // used in "Add a {singular}" buttons
}[] = [
  {
    group: "coworkers",
    label: "Co-workers",
    emoji: "🤝",
    hint: "Your staff and teammates — make them heroes.",
    singular: "co-worker",
  },
  {
    group: "customers",
    label: "Customers",
    emoji: "👥",
    hint: "Whoever the work is for — make them succeed with it.",
    singular: "customer",
  },
  {
    group: "suppliers",
    label: "Suppliers",
    emoji: "📦",
    hint: "The people who make the work possible — look out for them.",
    singular: "supplier",
  },
  {
    group: "world",
    label: "The World",
    emoji: "🌍",
    hint: "Someone beyond yourself — a stronger echo the further out you reach.",
    singular: "partner",
  },
];

/** Soft cap per group — the book says one person per group, so keep it focused. */
export const MAX_PARTNERS_PER_GROUP = 3;

/** The book's four/five personal-ethics defaults, seeded on a user's first visit. */
export const DEFAULT_ETHICS_PRINCIPLES: string[] = [
  "Protect life — don't harm any living creature; avoid even hurtful words or thoughts.",
  "Respect others' things — never steal or come close to it (no personal time on the clock, no fudging accounts).",
  "Respect others' relationships — never threaten a committed bond between two partners.",
  "Be truthful — never leave anyone with an impression you know to be false.",
  "Stay clear — don't get pulled into abusing alcohol or drugs.",
];
