import { describe, it, expect } from "vitest";
import { computeBudgetStatus } from "../expense-budget";

describe("expense budget domain", () => {
  it("reports no budget when budget is null", () => {
    const s = computeBudgetStatus(50, null);
    expect(s.hasBudget).toBe(false);
    expect(s.budget).toBe(0);
    expect(s.percentUsed).toBe(0);
    expect(s.isOver).toBe(false);
    expect(s.remaining).toBe(-50);
  });

  it("reports no budget when budget is undefined", () => {
    const s = computeBudgetStatus(0, undefined);
    expect(s.hasBudget).toBe(false);
    expect(s.percentUsed).toBe(0);
    expect(s.isOver).toBe(false);
  });

  it("reports no budget when budget is zero", () => {
    const s = computeBudgetStatus(10, 0);
    expect(s.hasBudget).toBe(false);
    expect(s.percentUsed).toBe(0);
    expect(s.isOver).toBe(false);
  });

  it("computes status when under budget", () => {
    const s = computeBudgetStatus(75, 100);
    expect(s.hasBudget).toBe(true);
    expect(s.remaining).toBe(25);
    expect(s.percentUsed).toBe(75);
    expect(s.isOver).toBe(false);
  });

  it("is not over when spent exactly equals budget", () => {
    const s = computeBudgetStatus(100, 100);
    expect(s.hasBudget).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.percentUsed).toBe(100);
    expect(s.isOver).toBe(false);
  });

  it("is over budget with negative remaining", () => {
    const s = computeBudgetStatus(150, 100);
    expect(s.hasBudget).toBe(true);
    expect(s.remaining).toBe(-50);
    expect(s.percentUsed).toBe(150);
    expect(s.isOver).toBe(true);
  });

  it("computes raw percentUsed math", () => {
    const s = computeBudgetStatus(50, 200);
    expect(s.percentUsed).toBe(25);
  });
});
