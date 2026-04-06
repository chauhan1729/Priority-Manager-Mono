/**
 * Communication Planner domain logic — spec §10.7.
 * Contact is the single source of truth for person records.
 * Delegated activities are the same shared Activity records used everywhere.
 */

import type { Activity, Contact, ContactCategory } from "@pm/types";

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export type ContactSortKey = "name" | "category" | "updated";

/** Sort contacts by the given key. Returns a new array; does not mutate. */
export function sortContacts(contacts: Contact[], sort: ContactSortKey): Contact[] {
  const copy = [...contacts];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.full_name.localeCompare(b.full_name));
    case "category":
      return copy.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.full_name.localeCompare(b.full_name),
      );
    case "updated":
      return copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Filter contacts by a text query across name, company, email, and note fields.
 * Case-insensitive. Empty query returns all contacts unchanged.
 * Spec §10.7: "Search should support: name, company, email, note text."
 */
export function filterContactsBySearch(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(
    (c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.company !== null && c.company.toLowerCase().includes(q)) ||
      (c.email !== null && c.email.toLowerCase().includes(q)) ||
      (c.note !== null && c.note.toLowerCase().includes(q)),
  );
}

/**
 * Filter contacts by category. "all" returns all contacts unchanged.
 */
export function filterContactsByCategory(
  contacts: Contact[],
  category: ContactCategory | "all",
): Contact[] {
  if (category === "all") return contacts;
  return contacts.filter((c) => c.category === category);
}

// ---------------------------------------------------------------------------
// Delegated activity linkage
// ---------------------------------------------------------------------------

/**
 * Returns activities delegated to a specific contact.
 * Spec §10.7: "Delegated activities linked to a contact should appear on that person's card."
 * Uses the shared Activity model — no separate delegated task model exists.
 */
export function getDelegatedActivitiesForContact(
  activities: Activity[],
  contactId: string,
): Activity[] {
  return activities.filter((a) => a.delegated_contact_id === contactId);
}

/**
 * Build a map of contactId → delegated activities for efficient card rendering.
 */
export function buildDelegatedMap(activities: Activity[]): Map<string, Activity[]> {
  const map = new Map<string, Activity[]>();
  for (const a of activities) {
    if (a.delegated_contact_id !== null) {
      const existing = map.get(a.delegated_contact_id);
      if (existing) {
        existing.push(a);
      } else {
        map.set(a.delegated_contact_id, [a]);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Deletion safety
// ---------------------------------------------------------------------------

export interface ContactDeletionInfo {
  /** Number of activities with delegated_contact_id pointing to this contact. */
  delegatedActivityCount: number;
  /** True when there is at least one linked record that would be affected. */
  hasDependents: boolean;
}

/**
 * Returns information needed for the safe-delete confirmation dialog.
 * Spec §10.7: "Do not delete historical records by default."
 */
export function getContactDeletionInfo(
  activities: Activity[],
  contactId: string,
): ContactDeletionInfo {
  const delegatedActivityCount = getDelegatedActivitiesForContact(activities, contactId).length;
  return {
    delegatedActivityCount,
    hasDependents: delegatedActivityCount > 0,
  };
}
