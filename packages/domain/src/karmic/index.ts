import {
  KARMIC_PARTNER_GROUPS,
  MAX_PARTNERS_PER_GROUP,
  type KarmicEthicsCheckin,
  type KarmicEthicsPrinciple,
  type KarmicPartner,
  type KarmicPartnerAction,
  type KarmicPartnerGroup,
} from "@pm/types";

/** The four partner groups in book order. */
export const KARMIC_PARTNER_GROUP_ORDER: KarmicPartnerGroup[] =
  KARMIC_PARTNER_GROUPS.map((g) => g.group);

export function isValidPartnerGroup(x: string): x is KarmicPartnerGroup {
  return KARMIC_PARTNER_GROUP_ORDER.includes(x as KarmicPartnerGroup);
}

/**
 * A log/action date is only allowed up to today — future-dating is rejected
 * (you can backfill a missed day, but not pre-commit tomorrow). Returns true
 * when `dateISO` is in the future relative to `todayISO` (i.e. should be blocked).
 * Both are ISO YYYY-MM-DD, which compare correctly as strings.
 */
export function isFutureLogDate(dateISO: string, todayISO: string): boolean {
  return dateISO > todayISO;
}

/** Group a day's partner actions by their partner group. */
export function groupActionsByGroup(
  actions: KarmicPartnerAction[],
): Map<KarmicPartnerGroup, KarmicPartnerAction[]> {
  const map = new Map<KarmicPartnerGroup, KarmicPartnerAction[]>();
  for (const g of KARMIC_PARTNER_GROUP_ORDER) map.set(g, []);
  for (const a of actions) {
    if (!isValidPartnerGroup(a.partner_group)) continue;
    map.get(a.partner_group)!.push(a);
  }
  return map;
}

/** Group a day's partner actions by the specific partner they belong to. */
export function groupActionsByPartner(
  actions: KarmicPartnerAction[],
): Map<string, KarmicPartnerAction[]> {
  const map = new Map<string, KarmicPartnerAction[]>();
  for (const a of actions) {
    if (!a.partner_id) continue;
    if (!map.has(a.partner_id)) map.set(a.partner_id, []);
    map.get(a.partner_id)!.push(a);
  }
  return map;
}

/** How many active partners a group currently holds. */
export function countActivePartnersInGroup(
  partners: KarmicPartner[],
  group: KarmicPartnerGroup,
): number {
  return partners.filter((p) => p.status === "active" && p.partner_group === group).length;
}

/** Whether another partner can be added to a group (soft cap). */
export function canAddPartner(partners: KarmicPartner[], group: KarmicPartnerGroup): boolean {
  return countActivePartnersInGroup(partners, group) < MAX_PARTNERS_PER_GROUP;
}

/** One partner card: the person + their actions for the selected day. */
export interface KarmicPartnerCard {
  partner: KarmicPartner;
  actions: KarmicPartnerAction[];
}

/** One group bucket: the four fixed groups, each holding zero or more partners. */
export interface KarmicPartnerBucket {
  group: KarmicPartnerGroup;
  label: string;
  emoji: string;
  hint: string;
  singular: string;
  partners: KarmicPartnerCard[];
}

/**
 * Build the board: the four groups (book order), each with its *active* partners
 * (sorted by sort_order, then created_at) and each partner's actions for the day.
 * Always returns all four groups, even when empty, so the UI can render every bucket.
 */
export function buildPartnerBoard(
  partners: KarmicPartner[],
  actions: KarmicPartnerAction[],
): KarmicPartnerBucket[] {
  const actionsByPartner = groupActionsByPartner(actions);
  const activeByGroup = new Map<KarmicPartnerGroup, KarmicPartner[]>();
  for (const g of KARMIC_PARTNER_GROUP_ORDER) activeByGroup.set(g, []);
  for (const p of partners) {
    if (p.status !== "active" || !isValidPartnerGroup(p.partner_group)) continue;
    activeByGroup.get(p.partner_group)!.push(p);
  }
  for (const list of activeByGroup.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  }
  return KARMIC_PARTNER_GROUPS.map(({ group, label, emoji, hint, singular }) => ({
    group,
    label,
    emoji,
    hint,
    singular,
    partners: (activeByGroup.get(group) ?? []).map((partner) => ({
      partner,
      actions: actionsByPartner.get(partner.id) ?? [],
    })),
  }));
}

export interface KarmicEthicsRow {
  principle: KarmicEthicsPrinciple;
  checkin: KarmicEthicsCheckin | null; // the selected day's check, if recorded
}

/**
 * Active principles (sorted by sort_order, then created_at) each paired with the
 * selected day's check-in if one exists. Inactive principles are dropped so the
 * nightly checklist only shows the code the user currently keeps.
 */
export function mergeEthicsChecklist(
  principles: KarmicEthicsPrinciple[],
  checkins: KarmicEthicsCheckin[],
): KarmicEthicsRow[] {
  const checkinByPrinciple = new Map(checkins.map((c) => [c.principle_id, c]));
  return principles
    .filter((p) => p.active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((principle) => ({
      principle,
      checkin: checkinByPrinciple.get(principle.id) ?? null,
    }));
}
