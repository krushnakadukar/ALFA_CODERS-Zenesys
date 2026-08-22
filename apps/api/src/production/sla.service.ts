export type SlaApprovalStep = {
  stepId: string;
  requestId: string;
  requesterEmployeeId: string;
  approverEmployeeId: string;
  approverName: string;
  approverManagerId?: string | null;
  organizationId: string;
  status: "PENDING" | "WAITING" | "SLA_REMINDER_SENT" | "SLA_BREACHED" | "ESCALATED";
  createdAt: Date;
  slaDeadline: Date;
  reason: string;
};

export type SlaEscalationTarget = {
  employeeId: string;
  name: string;
  reason: string;
};

export type SlaRunSummary = {
  remindersSent: number;
  breached: number;
  escalated: number;
  exceptions: number;
};

export interface SlaRepository {
  listPendingApprovalSteps(now: Date): Promise<SlaApprovalStep[]>;
  hasEvent(stepId: string, eventType: "SLA_REMINDER" | "SLA_BREACHED" | "SLA_ESCALATED" | "SLA_ESCALATION_EXCEPTION"): Promise<boolean>;
  recordReminder(step: SlaApprovalStep, now: Date): Promise<void>;
  markBreached(step: SlaApprovalStep, now: Date): Promise<void>;
  findEscalationTarget(step: SlaApprovalStep): Promise<SlaEscalationTarget | null>;
  escalate(step: SlaApprovalStep, target: SlaEscalationTarget, now: Date): Promise<void>;
  markEscalationException(step: SlaApprovalStep, now: Date, reason: string): Promise<void>;
}

export class SlaService {
  constructor(
    private readonly repository: SlaRepository,
    private readonly reminderPercent = 80
  ) {}

  async processDueEvents(now = new Date()): Promise<SlaRunSummary> {
    const summary: SlaRunSummary = { remindersSent: 0, breached: 0, escalated: 0, exceptions: 0 };
    const steps = await this.repository.listPendingApprovalSteps(now);

    for (const step of steps) {
      if (step.slaDeadline <= now) {
        if (!(await this.repository.hasEvent(step.stepId, "SLA_BREACHED"))) {
          await this.repository.markBreached(step, now);
          summary.breached += 1;
        }

        if (await this.repository.hasEvent(step.stepId, "SLA_ESCALATED")) continue;
        const target = await this.repository.findEscalationTarget(step);
        if (!target) {
          if (!(await this.repository.hasEvent(step.stepId, "SLA_ESCALATION_EXCEPTION"))) {
            await this.repository.markEscalationException(step, now, "No authorized escalation approver found");
            summary.exceptions += 1;
          }
          continue;
        }

        await this.repository.escalate(step, target, now);
        summary.escalated += 1;
        continue;
      }

      if (this.isReminderDue(step, now) && !(await this.repository.hasEvent(step.stepId, "SLA_REMINDER"))) {
        await this.repository.recordReminder(step, now);
        summary.remindersSent += 1;
      }
    }

    return summary;
  }

  private isReminderDue(step: SlaApprovalStep, now: Date) {
    const totalMs = step.slaDeadline.getTime() - step.createdAt.getTime();
    if (totalMs <= 0) return true;
    const elapsedMs = now.getTime() - step.createdAt.getTime();
    return elapsedMs / totalMs >= this.reminderPercent / 100;
  }
}
