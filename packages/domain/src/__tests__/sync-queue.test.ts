import { describe, it, expect } from "vitest";

import {
  createQueue,
  dequeue,
  enqueue,
  getExhausted,
  getRetryable,
  incrementRetry,
  isExhausted,
  isQueueEmpty,
  queueDepth,
  type SyncQueueItem,
} from "../sync/queue";

import {
  isSafeUpdate,
  resolveConflict,
  mergePayload,
  SENSITIVE_FIELDS,
} from "../sync/conflict";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<SyncQueueItem> = {}): Omit<SyncQueueItem, "id" | "retries"> {
  return {
    table: "activities",
    operation: "update",
    record_id: "act-1",
    payload: { title: "New title" },
    timestamp: Date.now(),
    max_retries: 3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createQueue
// ---------------------------------------------------------------------------

describe("createQueue", () => {
  it("creates an empty queue", () => {
    const q = createQueue();
    expect(q.items).toHaveLength(0);
    expect(isQueueEmpty(q)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

describe("enqueue", () => {
  it("adds a new item with id and retries=0", () => {
    const q = enqueue(createQueue(), makeItem());
    expect(q.items).toHaveLength(1);
    expect(q.items[0]!.retries).toBe(0);
    expect(typeof q.items[0]!.id).toBe("string");
  });

  it("does not mutate the original queue", () => {
    const original = createQueue();
    const updated = enqueue(original, makeItem());
    expect(original.items).toHaveLength(0);
    expect(updated.items).toHaveLength(1);
  });

  it("coalesces duplicate updates for the same record (latest payload wins)", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ payload: { title: "First" }, timestamp: 1000 }));
    q = enqueue(q, makeItem({ payload: { title: "Second" }, timestamp: 2000 }));

    expect(q.items).toHaveLength(1); // coalesced
    expect(q.items[0]!.payload["title"]).toBe("Second");
    expect(q.items[0]!.timestamp).toBe(2000);
  });

  it("merges payloads when coalescing updates (partial field updates)", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ payload: { title: "T1" }, timestamp: 1000 }));
    q = enqueue(q, makeItem({ payload: { status: "completed" }, timestamp: 2000 }));

    expect(q.items).toHaveLength(1);
    expect(q.items[0]!.payload["title"]).toBe("T1");
    expect(q.items[0]!.payload["status"]).toBe("completed");
  });

  it("does NOT coalesce creates with updates", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ operation: "create", record_id: "act-1" }));
    q = enqueue(q, makeItem({ operation: "update", record_id: "act-1" }));
    expect(q.items).toHaveLength(2);
  });

  it("does NOT coalesce updates for different records", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ record_id: "act-1" }));
    q = enqueue(q, makeItem({ record_id: "act-2" }));
    expect(q.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// dequeue
// ---------------------------------------------------------------------------

describe("dequeue", () => {
  it("removes item by id", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ record_id: "act-1" }));
    const id = q.items[0]!.id;
    q = dequeue(q, id);
    expect(q.items).toHaveLength(0);
  });

  it("leaves other items intact", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ record_id: "act-1" }));
    q = enqueue(q, makeItem({ record_id: "act-2" }));
    const id = q.items[0]!.id;
    q = dequeue(q, id);
    expect(q.items).toHaveLength(1);
    expect(q.items[0]!.record_id).toBe("act-2");
  });

  it("does not mutate original queue", () => {
    let q = createQueue();
    q = enqueue(q, makeItem());
    const original = q;
    dequeue(q, q.items[0]!.id);
    expect(original.items).toHaveLength(1); // original unchanged
  });
});

// ---------------------------------------------------------------------------
// incrementRetry / isExhausted
// ---------------------------------------------------------------------------

describe("incrementRetry", () => {
  it("increments retry count by 1", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ max_retries: 3 }));
    const id = q.items[0]!.id;
    q = incrementRetry(q, id);
    expect(q.items[0]!.retries).toBe(1);
  });
});

describe("isExhausted", () => {
  it("returns true when retries >= max_retries", () => {
    const item: SyncQueueItem = {
      id: "x",
      table: "activities",
      operation: "update",
      record_id: "act-1",
      payload: {},
      timestamp: 0,
      retries: 3,
      max_retries: 3,
    };
    expect(isExhausted(item)).toBe(true);
  });

  it("returns false when retries < max_retries", () => {
    const item: SyncQueueItem = {
      id: "x",
      table: "activities",
      operation: "update",
      record_id: "act-1",
      payload: {},
      timestamp: 0,
      retries: 2,
      max_retries: 3,
    };
    expect(isExhausted(item)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRetryable / getExhausted
// ---------------------------------------------------------------------------

describe("getRetryable / getExhausted", () => {
  it("getRetryable returns items not exhausted", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ record_id: "act-1", max_retries: 1 }));
    q = enqueue(q, makeItem({ record_id: "act-2", max_retries: 3 }));
    // Exhaust act-1
    const id1 = q.items.find((i) => i.record_id === "act-1")!.id;
    q = incrementRetry(q, id1);

    const retryable = getRetryable(q);
    expect(retryable.map((i) => i.record_id)).toEqual(["act-2"]);
  });

  it("getExhausted returns only exhausted items", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ record_id: "act-1", max_retries: 1 }));
    const id1 = q.items[0]!.id;
    q = incrementRetry(q, id1);
    expect(getExhausted(q).map((i) => i.record_id)).toEqual(["act-1"]);
  });
});

// ---------------------------------------------------------------------------
// queueDepth
// ---------------------------------------------------------------------------

describe("queueDepth", () => {
  it("returns 0 for empty queue", () => {
    expect(queueDepth(createQueue())).toBe(0);
  });

  it("returns count of items", () => {
    let q = createQueue();
    q = enqueue(q, makeItem({ record_id: "a" }));
    q = enqueue(q, makeItem({ record_id: "b" }));
    expect(queueDepth(q)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// resolveConflict
// ---------------------------------------------------------------------------

describe("resolveConflict", () => {
  function makeQueuedItem(timestamp: number, operation: "create" | "update" | "delete" = "update"): SyncQueueItem {
    return {
      id: "q1",
      table: "activities",
      operation,
      record_id: "act-1",
      payload: { title: "Local edit" },
      timestamp,
      retries: 0,
      max_retries: 3,
    };
  }

  it("always applies creates", () => {
    const item = makeQueuedItem(1000, "create");
    expect(resolveConflict(item, "2026-04-05T00:00:00Z")).toBe("apply");
  });

  it("always applies deletes", () => {
    const item = makeQueuedItem(1000, "delete");
    expect(resolveConflict(item, "2026-04-05T00:00:00Z")).toBe("apply");
  });

  it("applies update when no server record exists", () => {
    const item = makeQueuedItem(1000);
    expect(resolveConflict(item, null)).toBe("apply");
  });

  it("applies update when queued timestamp is newer than server", () => {
    const serverUpdated = new Date("2026-04-05T10:00:00Z").getTime();
    const item = makeQueuedItem(serverUpdated + 1000); // 1 second newer
    expect(resolveConflict(item, "2026-04-05T10:00:00Z")).toBe("apply");
  });

  it("skips update when server is newer (server wins)", () => {
    const serverUpdated = new Date("2026-04-05T10:00:00Z").getTime();
    const item = makeQueuedItem(serverUpdated - 1000); // 1 second older
    expect(resolveConflict(item, "2026-04-05T10:00:00Z")).toBe("skip");
  });

  it("applies update when timestamps are equal (local not strictly older)", () => {
    const serverUpdated = new Date("2026-04-05T10:00:00Z").getTime();
    const item = makeQueuedItem(serverUpdated); // exactly equal
    expect(resolveConflict(item, "2026-04-05T10:00:00Z")).toBe("apply");
  });
});

// ---------------------------------------------------------------------------
// isSafeUpdate
// ---------------------------------------------------------------------------

describe("isSafeUpdate", () => {
  it("returns true for low-risk fields", () => {
    expect(isSafeUpdate({ title: "New title", note: "A note" })).toBe(true);
  });

  it("returns false when payload contains sensitive fields", () => {
    expect(isSafeUpdate({ title: "T", status: "completed" })).toBe(false);
    expect(isSafeUpdate({ linked_project_id: "proj-1" })).toBe(false);
    expect(isSafeUpdate({ recurrence_rule: "monthly" })).toBe(false);
  });

  it("SENSITIVE_FIELDS covers all linked FKs", () => {
    expect(SENSITIVE_FIELDS.has("linked_project_id")).toBe(true);
    expect(SENSITIVE_FIELDS.has("linked_contact_id")).toBe(true);
    expect(SENSITIVE_FIELDS.has("linked_calendar_event_id")).toBe(true);
    expect(SENSITIVE_FIELDS.has("linked_year_entry_id")).toBe(true);
    expect(SENSITIVE_FIELDS.has("linked_expense_id")).toBe(true);
    expect(SENSITIVE_FIELDS.has("linked_meeting_id")).toBe(true);
    expect(SENSITIVE_FIELDS.has("status")).toBe(true);
    expect(SENSITIVE_FIELDS.has("recurrence_rule")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergePayload
// ---------------------------------------------------------------------------

describe("mergePayload", () => {
  it("merges queued payload over server record", () => {
    const server = { id: "1", title: "Old", status: "upcoming", note: "Keep me" };
    const queued = { title: "New title" };
    const merged = mergePayload(server, queued);
    expect(merged["title"]).toBe("New title");
    expect(merged["status"]).toBe("upcoming");
    expect(merged["note"]).toBe("Keep me");
  });

  it("queued fields override server fields", () => {
    const server = { status: "upcoming" };
    const queued = { status: "completed" };
    expect(mergePayload(server, queued)["status"]).toBe("completed");
  });
});
