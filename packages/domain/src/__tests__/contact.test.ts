import { describe, expect, it } from "vitest";

import type { Activity, Contact } from "@pm/types";

import {
  buildDelegatedMap,
  filterContactsByCategory,
  filterContactsBySearch,
  getDelegatedActivitiesForContact,
  getContactDeletionInfo,
  sortContacts,
} from "../contact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    category: "professional",
    full_name: "Alice Smith",
    company: "Acme Corp",
    role: "Engineer",
    phone: null,
    email: "alice@acme.com",
    note: null,
    is_deleted: false,
    created_at: "2026-04-01T10:00:00.000Z",
    updated_at: "2026-04-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    section_type: "delegated",
    title: "Follow up on proposal",
    priority: "B",
    activity_date: "2026-04-05",
    estimated_minutes: 30,
    remaining_minutes: 30,
    status: "not_started",
    linked_project_id: null,
    delegated_contact_id: null,
    note: null,
    origin_type: "manual",
    moved_from_date: null,
    hours_worked: 0,
    archived: false,
    is_someday: false,
    is_weekly: false,
    recurrence_rule: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sortContacts
// ---------------------------------------------------------------------------

describe("sortContacts", () => {
  it("sorts by name alphabetically", () => {
    const contacts = [
      makeContact({ full_name: "Zara" }),
      makeContact({ full_name: "Alice" }),
      makeContact({ full_name: "Mike" }),
    ];
    const result = sortContacts(contacts, "name");
    expect(result.map((c) => c.full_name)).toEqual(["Alice", "Mike", "Zara"]);
  });

  it("sorts by category, then by name within category", () => {
    const contacts = [
      makeContact({ category: "vendor", full_name: "ZVendor" }),
      makeContact({ category: "client", full_name: "BClient" }),
      makeContact({ category: "client", full_name: "AClient" }),
    ];
    const result = sortContacts(contacts, "category");
    expect(result[0]?.full_name).toBe("AClient");
    expect(result[1]?.full_name).toBe("BClient");
    expect(result[2]?.full_name).toBe("ZVendor");
  });

  it("sorts by updated_at descending (most recent first)", () => {
    const contacts = [
      makeContact({ full_name: "Old", updated_at: "2026-01-01T00:00:00.000Z" }),
      makeContact({ full_name: "New", updated_at: "2026-04-01T00:00:00.000Z" }),
    ];
    const result = sortContacts(contacts, "updated");
    expect(result[0]?.full_name).toBe("New");
    expect(result[1]?.full_name).toBe("Old");
  });

  it("does not mutate the original array", () => {
    const contacts = [makeContact({ full_name: "B" }), makeContact({ full_name: "A" })];
    const original = [...contacts];
    sortContacts(contacts, "name");
    expect(contacts[0]?.full_name).toBe(original[0]?.full_name);
  });
});

// ---------------------------------------------------------------------------
// filterContactsBySearch
// ---------------------------------------------------------------------------

describe("filterContactsBySearch", () => {
  it("returns all contacts when query is empty", () => {
    const contacts = [makeContact(), makeContact()];
    expect(filterContactsBySearch(contacts, "")).toHaveLength(2);
  });

  it("returns all contacts when query is only whitespace", () => {
    const contacts = [makeContact(), makeContact()];
    expect(filterContactsBySearch(contacts, "   ")).toHaveLength(2);
  });

  it("matches by full_name (case-insensitive)", () => {
    // Use null/unique emails so the name is the only matching field
    const contacts = [
      makeContact({ full_name: "Alice Smith", email: null, company: null }),
      makeContact({ full_name: "Bob Jones", email: null, company: null }),
    ];
    expect(filterContactsBySearch(contacts, "ALICE")).toHaveLength(1);
    expect(filterContactsBySearch(contacts, "alice")).toHaveLength(1);
  });

  it("matches by company", () => {
    // Use null email so the company is the only matching field
    const contacts = [
      makeContact({ company: "Uniqueco Ltd", email: null }),
      makeContact({ company: "Beta LLC", email: null }),
    ];
    expect(filterContactsBySearch(contacts, "uniqueco")).toHaveLength(1);
  });

  it("matches by email", () => {
    const contacts = [makeContact({ email: "alice@acme.com" }), makeContact({ email: "bob@beta.com" })];
    expect(filterContactsBySearch(contacts, "acme.com")).toHaveLength(1);
  });

  it("matches by note text", () => {
    const contacts = [
      makeContact({ note: "Met at conference in Berlin" }),
      makeContact({ note: "Old client" }),
    ];
    expect(filterContactsBySearch(contacts, "berlin")).toHaveLength(1);
  });

  it("returns empty array when no contacts match", () => {
    const contacts = [makeContact({ full_name: "Alice" }), makeContact({ full_name: "Bob" })];
    expect(filterContactsBySearch(contacts, "zzz")).toHaveLength(0);
  });

  it("handles null fields safely", () => {
    const contacts = [makeContact({ company: null, email: null, note: null })];
    expect(() => filterContactsBySearch(contacts, "test")).not.toThrow();
    expect(filterContactsBySearch(contacts, "test")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterContactsByCategory
// ---------------------------------------------------------------------------

describe("filterContactsByCategory", () => {
  it("returns all contacts for 'all'", () => {
    const contacts = [
      makeContact({ category: "personal" }),
      makeContact({ category: "client" }),
    ];
    expect(filterContactsByCategory(contacts, "all")).toHaveLength(2);
  });

  it("filters to specific category", () => {
    const contacts = [
      makeContact({ category: "personal" }),
      makeContact({ category: "client" }),
    ];
    expect(filterContactsByCategory(contacts, "client")).toHaveLength(1);
    expect(filterContactsByCategory(contacts, "client")[0]?.category).toBe("client");
  });
});

// ---------------------------------------------------------------------------
// getDelegatedActivitiesForContact
// ---------------------------------------------------------------------------

describe("getDelegatedActivitiesForContact — delegated activity linkage", () => {
  it("returns activities linked to the contact", () => {
    const contactId = "contact-1";
    const activities = [
      makeActivity({ delegated_contact_id: contactId }),
      makeActivity({ delegated_contact_id: "contact-2" }),
      makeActivity({ delegated_contact_id: null }),
    ];
    const result = getDelegatedActivitiesForContact(activities, contactId);
    expect(result).toHaveLength(1);
    expect(result[0]?.delegated_contact_id).toBe(contactId);
  });

  it("returns empty array when contact has no delegated activities", () => {
    const activities = [makeActivity({ delegated_contact_id: "other" })];
    expect(getDelegatedActivitiesForContact(activities, "contact-1")).toHaveLength(0);
  });

  it("does not include activities linked to other contacts", () => {
    const activities = [
      makeActivity({ delegated_contact_id: "contact-A" }),
      makeActivity({ delegated_contact_id: "contact-B" }),
    ];
    const result = getDelegatedActivitiesForContact(activities, "contact-A");
    expect(result.every((a) => a.delegated_contact_id === "contact-A")).toBe(true);
  });

  it("handles all null delegated_contact_id safely", () => {
    const activities = [makeActivity({ delegated_contact_id: null })];
    expect(getDelegatedActivitiesForContact(activities, "contact-1")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildDelegatedMap
// ---------------------------------------------------------------------------

describe("buildDelegatedMap", () => {
  it("groups activities by contact id", () => {
    const contactId = "contact-1";
    const activities = [
      makeActivity({ delegated_contact_id: contactId }),
      makeActivity({ delegated_contact_id: contactId }),
      makeActivity({ delegated_contact_id: "contact-2" }),
    ];
    const map = buildDelegatedMap(activities);
    expect(map.get(contactId)).toHaveLength(2);
    expect(map.get("contact-2")).toHaveLength(1);
  });

  it("ignores activities with null delegated_contact_id", () => {
    const activities = [makeActivity({ delegated_contact_id: null })];
    const map = buildDelegatedMap(activities);
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getContactDeletionInfo — safe delete behavior
// ---------------------------------------------------------------------------

describe("getContactDeletionInfo — safe delete behavior", () => {
  it("reports zero dependents when no delegated activities exist", () => {
    const info = getContactDeletionInfo([], "contact-1");
    expect(info.delegatedActivityCount).toBe(0);
    expect(info.hasDependents).toBe(false);
  });

  it("counts only activities linked to this contact", () => {
    const contactId = "contact-1";
    const activities = [
      makeActivity({ delegated_contact_id: contactId }),
      makeActivity({ delegated_contact_id: contactId }),
      makeActivity({ delegated_contact_id: "other" }),
    ];
    const info = getContactDeletionInfo(activities, contactId);
    expect(info.delegatedActivityCount).toBe(2);
    expect(info.hasDependents).toBe(true);
  });

  it("reports hasDependents = true when delegated activities exist", () => {
    const contactId = "contact-1";
    const activities = [makeActivity({ delegated_contact_id: contactId })];
    const info = getContactDeletionInfo(activities, contactId);
    expect(info.hasDependents).toBe(true);
  });
});
