import { describe, expect, it } from "vitest";

import {
  DEFAULT_ETHICS_PRINCIPLES,
  type KarmicEthicsCheckin,
  type KarmicEthicsPrinciple,
  type KarmicPartner,
  type KarmicPartnerAction,
  type KarmicPartnerGroup,
} from "@pm/types";

import {
  buildPartnerBoard,
  canAddPartner,
  countActivePartnersInGroup,
  groupActionsByPartner,
  isFutureLogDate,
  isValidPartnerGroup,
  KARMIC_PARTNER_GROUP_ORDER,
  mergeEthicsChecklist,
} from "../karmic";

function makePartner(
  group: KarmicPartnerGroup,
  id: string,
  overrides: Partial<KarmicPartner> = {},
): KarmicPartner {
  return {
    id,
    user_id: "u1",
    partner_group: group,
    name: `Name ${id}`,
    success_vision: `Vision ${id}`,
    status: "active",
    sort_order: 0,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAction(
  partnerId: string,
  group: KarmicPartnerGroup,
  overrides: Partial<KarmicPartnerAction> = {},
): KarmicPartnerAction {
  return {
    id: `action-${partnerId}-${overrides.text ?? "x"}`,
    user_id: "u1",
    partner_id: partnerId,
    partner_group: group,
    action_date: "2026-08-03",
    text: overrides.text ?? "do a thing",
    done: false,
    created_at: "2026-08-03T00:00:00.000Z",
    updated_at: "2026-08-03T00:00:00.000Z",
    ...overrides,
  };
}

function makePrinciple(id: string, overrides: Partial<KarmicEthicsPrinciple> = {}): KarmicEthicsPrinciple {
  return {
    id,
    user_id: "u1",
    label: `Principle ${id}`,
    sort_order: 0,
    active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isFutureLogDate", () => {
  it("blocks a future date", () => {
    expect(isFutureLogDate("2026-08-04", "2026-08-03")).toBe(true);
  });
  it("allows today and past dates (backfill)", () => {
    expect(isFutureLogDate("2026-08-03", "2026-08-03")).toBe(false);
    expect(isFutureLogDate("2026-07-30", "2026-08-03")).toBe(false);
  });
});

describe("isValidPartnerGroup", () => {
  it("accepts the four groups and rejects others", () => {
    expect(KARMIC_PARTNER_GROUP_ORDER).toEqual(["coworkers", "customers", "suppliers", "world"]);
    expect(isValidPartnerGroup("suppliers")).toBe(true);
    expect(isValidPartnerGroup("bogus")).toBe(false);
  });
});

describe("groupActionsByPartner", () => {
  it("buckets actions by partner id", () => {
    const map = groupActionsByPartner([
      makeAction("p1", "coworkers", { text: "a" }),
      makeAction("p1", "coworkers", { text: "b" }),
      makeAction("p2", "coworkers", { text: "c" }),
    ]);
    expect(map.get("p1")).toHaveLength(2);
    expect(map.get("p2")).toHaveLength(1);
  });
});

describe("countActivePartnersInGroup / canAddPartner", () => {
  const partners = [
    makePartner("coworkers", "p1"),
    makePartner("coworkers", "p2"),
    makePartner("coworkers", "p3", { status: "retired" }),
    makePartner("customers", "p4"),
  ];
  it("counts only active partners in the group", () => {
    expect(countActivePartnersInGroup(partners, "coworkers")).toBe(2);
    expect(countActivePartnersInGroup(partners, "world")).toBe(0);
  });
  it("allows adding until the cap (3 active)", () => {
    expect(canAddPartner(partners, "coworkers")).toBe(true);
    const full = [...partners, makePartner("coworkers", "p5")];
    expect(canAddPartner(full, "coworkers")).toBe(false);
  });
});

describe("buildPartnerBoard", () => {
  it("returns all four buckets in order, even when empty", () => {
    const board = buildPartnerBoard([], []);
    expect(board.map((s) => s.group)).toEqual(["coworkers", "customers", "suppliers", "world"]);
    expect(board.every((s) => s.partners.length === 0)).toBe(true);
    expect(board[0]!.label).toBe("Co-workers");
    expect(board[0]!.singular).toBe("co-worker");
  });
  it("nests active partners (sorted) with their own actions under the right bucket", () => {
    const board = buildPartnerBoard(
      [
        makePartner("coworkers", "p2", { name: "Sam", sort_order: 1 }),
        makePartner("coworkers", "p1", { name: "Priya", sort_order: 0 }),
        makePartner("customers", "c1", { name: "Acme" }),
      ],
      [
        makeAction("p1", "coworkers", { text: "review PR" }),
        makeAction("c1", "customers", { text: "send breakdown" }),
      ],
    );
    const coworkers = board.find((s) => s.group === "coworkers")!;
    expect(coworkers.partners.map((c) => c.partner.name)).toEqual(["Priya", "Sam"]);
    expect(coworkers.partners[0]!.actions).toHaveLength(1);
    expect(coworkers.partners[1]!.actions).toHaveLength(0);
    expect(board.find((s) => s.group === "customers")!.partners[0]!.actions).toHaveLength(1);
    expect(board.find((s) => s.group === "world")!.partners).toHaveLength(0);
  });
  it("hides retired partners from the board", () => {
    const board = buildPartnerBoard([makePartner("suppliers", "s1", { status: "retired" })], []);
    expect(board.find((s) => s.group === "suppliers")!.partners).toHaveLength(0);
  });
});

describe("mergeEthicsChecklist", () => {
  it("keeps only active principles, sorted by sort_order", () => {
    const rows = mergeEthicsChecklist(
      [
        makePrinciple("b", { sort_order: 2 }),
        makePrinciple("a", { sort_order: 1 }),
        makePrinciple("z", { sort_order: 0, active: false }),
      ],
      [],
    );
    expect(rows.map((r) => r.principle.id)).toEqual(["a", "b"]);
  });
  it("attaches the day's check-in to its principle", () => {
    const checkin: KarmicEthicsCheckin = {
      id: "c1",
      user_id: "u1",
      checkin_date: "2026-08-03",
      principle_id: "a",
      kept: false,
      note: "slipped",
      created_at: "2026-08-03T00:00:00.000Z",
      updated_at: "2026-08-03T00:00:00.000Z",
    };
    const rows = mergeEthicsChecklist([makePrinciple("a"), makePrinciple("b")], [checkin]);
    expect(rows[0]!.checkin?.kept).toBe(false);
    expect(rows[1]!.checkin).toBeNull();
  });
});

describe("defaults", () => {
  it("ships the book's five ethics defaults", () => {
    expect(DEFAULT_ETHICS_PRINCIPLES).toHaveLength(5);
    expect(DEFAULT_ETHICS_PRINCIPLES[0]).toMatch(/Protect life/);
  });
});
