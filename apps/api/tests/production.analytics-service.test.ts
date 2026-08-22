import { describe, expect, it } from "vitest";
import { average, calculateBottlenecks, hoursBetween } from "../src/production/analytics.service.js";

describe("production analytics service", () => {
  it("calculates bottleneck hours from persisted approval-chain style rows", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");

    const bottlenecks = calculateBottlenecks([
      { approverSource: "FINANCE", status: "PENDING", createdAt: new Date("2026-08-21T08:00:00.000Z") },
      { approverSource: "FINANCE", status: "SLA_BREACHED", createdAt: new Date("2026-08-21T06:00:00.000Z") },
      { approverSource: "HR", status: "APPROVED", createdAt: new Date("2026-08-21T06:00:00.000Z"), actionAt: new Date("2026-08-21T07:00:00.000Z") },
      { approverSource: "IT", status: "SLA_REMINDER_SENT", createdAt: new Date("2026-08-21T10:00:00.000Z") }
    ], now);

    expect(bottlenecks).toEqual([
      { stage: "FINANCE", count: 2, averageHours: 5, breached: 1 },
      { stage: "IT", count: 1, averageHours: 2, breached: 0 }
    ]);
  });

  it("handles empty and invalid averages safely", () => {
    expect(average([])).toBe(0);
    expect(average([null, undefined, Number.NaN])).toBe(0);
    expect(average([1, 2, 3])).toBe(2);
  });

  it("never reports negative elapsed hours", () => {
    expect(hoursBetween(new Date("2026-08-21T12:00:00.000Z"), new Date("2026-08-21T10:00:00.000Z"))).toBe(0);
  });
});
