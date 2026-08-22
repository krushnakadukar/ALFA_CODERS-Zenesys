import { describe, expect, it } from "vitest";
import { SlaService, type SlaApprovalStep, type SlaRepository } from "../src/production/sla.service.js";

const baseStep: SlaApprovalStep = {
  stepId: "REQ1-1-DIRECT_MANAGER",
  requestId: "REQ1",
  requesterEmployeeId: "E1",
  approverEmployeeId: "E2",
  approverName: "Manager",
  approverManagerId: "E3",
  organizationId: "ORG1",
  status: "PENDING",
  createdAt: new Date("2026-08-21T08:00:00.000Z"),
  slaDeadline: new Date("2026-08-21T18:00:00.000Z"),
  reason: "Manager approval required"
};

describe("production SLA service", () => {
  it("sends a reminder when elapsed time crosses configured threshold", async () => {
    const calls: string[] = [];
    const repo = repository([baseStep], calls);

    const summary = await new SlaService(repo, 80).processDueEvents(new Date("2026-08-21T16:01:00.000Z"));

    expect(summary.remindersSent).toBe(1);
    expect(calls).toEqual(["reminder:REQ1-1-DIRECT_MANAGER"]);
  });

  it("marks breached and escalates to an authorized higher approver", async () => {
    const calls: string[] = [];
    const repo = repository([{ ...baseStep, slaDeadline: new Date("2026-08-21T09:00:00.000Z") }], calls, "E3");

    const summary = await new SlaService(repo).processDueEvents(new Date("2026-08-21T10:00:00.000Z"));

    expect(summary.breached).toBe(1);
    expect(summary.escalated).toBe(1);
    expect(calls).toEqual(["breach:REQ1-1-DIRECT_MANAGER", "escalate:REQ1-1-DIRECT_MANAGER:E3"]);
  });

  it("records an exception when breached approval has no escalation approver", async () => {
    const calls: string[] = [];
    const repo = repository([{ ...baseStep, slaDeadline: new Date("2026-08-21T09:00:00.000Z") }], calls, null);

    const summary = await new SlaService(repo).processDueEvents(new Date("2026-08-21T10:00:00.000Z"));

    expect(summary.exceptions).toBe(1);
    expect(calls).toEqual(["breach:REQ1-1-DIRECT_MANAGER", "exception:REQ1-1-DIRECT_MANAGER"]);
  });
});

function repository(steps: SlaApprovalStep[], calls: string[], escalationTarget: string | null = "E3"): SlaRepository {
  const events = new Set<string>();
  return {
    async listPendingApprovalSteps() {
      return steps;
    },
    async hasEvent(stepId, eventType) {
      return events.has(`${stepId}:${eventType}`);
    },
    async recordReminder(step) {
      events.add(`${step.stepId}:SLA_REMINDER`);
      calls.push(`reminder:${step.stepId}`);
    },
    async markBreached(step) {
      events.add(`${step.stepId}:SLA_BREACHED`);
      calls.push(`breach:${step.stepId}`);
    },
    async findEscalationTarget() {
      return escalationTarget ? { employeeId: escalationTarget, name: "Escalation Manager", reason: "Next authorized hierarchy level" } : null;
    },
    async escalate(step, target) {
      events.add(`${step.stepId}:SLA_ESCALATED`);
      calls.push(`escalate:${step.stepId}:${target.employeeId}`);
    },
    async markEscalationException(step) {
      events.add(`${step.stepId}:SLA_ESCALATION_EXCEPTION`);
      calls.push(`exception:${step.stepId}`);
    }
  };
}
