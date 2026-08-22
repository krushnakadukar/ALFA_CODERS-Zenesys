import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import type { SlaApprovalStep, SlaEscalationTarget, SlaRepository } from "./sla.service.js";

type StepRow = {
  stepId: string;
  requestId: string;
  requesterEmployeeId: string;
  approverEmployeeId: string;
  approverName: string;
  approverManagerId: string | null;
  organizationId: string;
  status: SlaApprovalStep["status"];
  createdAt: Date;
  slaDeadline: Date;
  reason: string;
};

export class PrismaSlaRepository implements SlaRepository {
  async listPendingApprovalSteps(): Promise<SlaApprovalStep[]> {
    return prisma.$queryRaw<StepRow[]>`
      SELECT
        acs.approval_chain_step_id AS stepId,
        acs.request_id AS requestId,
        r.employee_id AS requesterEmployeeId,
        acs.approver_id AS approverEmployeeId,
        approver.name AS approverName,
        approver.manager_id AS approverManagerId,
        r.organization_id AS organizationId,
        acs.status AS status,
        acs.created_at AS createdAt,
        acs.sla_deadline AS slaDeadline,
        acs.reason AS reason
      FROM approval_chain_steps acs
      INNER JOIN requests r ON r.request_id = acs.request_id
      INNER JOIN employees approver ON approver.employee_id = acs.approver_id
      WHERE acs.status IN ('PENDING', 'SLA_REMINDER_SENT')
        AND acs.sla_deadline IS NOT NULL
      ORDER BY acs.sla_deadline ASC
    `;
  }

  async hasEvent(stepId: string, eventType: "SLA_REMINDER" | "SLA_BREACHED" | "SLA_ESCALATED" | "SLA_ESCALATION_EXCEPTION") {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT sla_event_id AS id
      FROM sla_events
      WHERE approval_chain_step_id = ${stepId}
        AND event_type = ${eventType}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async recordReminder(step: SlaApprovalStep, now: Date) {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE approval_chain_steps
        SET status = 'SLA_REMINDER_SENT'
        WHERE approval_chain_step_id = ${step.stepId}
          AND status = 'PENDING'
      `,
      prisma.$executeRaw`
        INSERT INTO sla_events
          (sla_event_id, request_id, approval_chain_step_id, event_type, event_at, deadline_at, actor_id, details)
        VALUES
          (${`SLA-${randomUUID()}`}, ${step.requestId}, ${step.stepId}, 'SLA_REMINDER', ${now}, ${step.slaDeadline}, NULL, ${`Reminder sent to ${step.approverName}`})
      `,
      prisma.notification.create({
        data: {
          id: `N-${randomUUID()}`,
          requestId: step.requestId,
          recipientEmployeeId: step.approverEmployeeId,
          message: `SLA reminder: approval for request ${step.requestId} is approaching its deadline`,
          status: "Unread",
          createdAt: now
        }
      }),
      prisma.auditLog.create({
        data: {
          id: `AUD-${randomUUID()}`,
          requestId: step.requestId,
          actorId: null,
          eventType: "SLA_REMINDER",
          eventAt: now,
          details: `Reminder sent for approval step ${step.stepId}`
        }
      })
    ]);
  }

  async markBreached(step: SlaApprovalStep, now: Date) {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE approval_chain_steps
        SET status = 'SLA_BREACHED'
        WHERE approval_chain_step_id = ${step.stepId}
          AND status IN ('PENDING', 'SLA_REMINDER_SENT')
      `,
      prisma.$executeRaw`
        INSERT INTO sla_events
          (sla_event_id, request_id, approval_chain_step_id, event_type, event_at, deadline_at, actor_id, details)
        VALUES
          (${`SLA-${randomUUID()}`}, ${step.requestId}, ${step.stepId}, 'SLA_BREACHED', ${now}, ${step.slaDeadline}, NULL, ${`SLA breached for approver ${step.approverName}`})
      `,
      prisma.auditLog.create({
        data: {
          id: `AUD-${randomUUID()}`,
          requestId: step.requestId,
          actorId: null,
          eventType: "SLA_BREACHED",
          eventAt: now,
          details: `SLA breached for approval step ${step.stepId}`
        }
      })
    ]);
  }

  async findEscalationTarget(step: SlaApprovalStep): Promise<SlaEscalationTarget | null> {
    const candidates = await prisma.$queryRaw<Array<{ employeeId: string; name: string }>>`
      SELECT employee_id AS employeeId, name
      FROM employees
      WHERE employee_id = ${step.approverManagerId ?? ""}
        AND organization_id = ${step.organizationId}
        AND employment_status = 'Active'
        AND availability_status = 'Available'
        AND employee_id <> ${step.requesterEmployeeId}
      LIMIT 1
    `;
    if (candidates[0]) {
      return {
        employeeId: candidates[0].employeeId,
        name: candidates[0].name,
        reason: "Escalated to approver's active reporting manager"
      };
    }

    const admins = await prisma.$queryRaw<Array<{ employeeId: string; name: string }>>`
      SELECT e.employee_id AS employeeId, e.name
      FROM employees e
      INNER JOIN roles r ON r.role_id = e.role_id
      LEFT JOIN departments d ON d.department_id = e.department_id
      WHERE e.organization_id = ${step.organizationId}
        AND e.employment_status = 'Active'
        AND e.availability_status = 'Available'
        AND e.employee_id <> ${step.requesterEmployeeId}
        AND (r.role_name IN ('CHRO', 'Admin Executive') OR d.name = 'Human Resources')
      ORDER BY e.name ASC
      LIMIT 1
    `;
    return admins[0]
      ? { employeeId: admins[0].employeeId, name: admins[0].name, reason: "Escalated to workflow administrator/HR authority" }
      : null;
  }

  async escalate(step: SlaApprovalStep, target: SlaEscalationTarget, now: Date) {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE approval_chain_steps
        SET approver_id = ${target.employeeId},
            approver_source = 'BUSINESS_UNIT_HEAD',
            status = 'ESCALATED',
            action_at = ${now}
        WHERE approval_chain_step_id = ${step.stepId}
      `,
      prisma.approval.updateMany({
        where: { requestId: step.requestId, approverId: step.approverEmployeeId, status: "Pending" },
        data: { approverId: target.employeeId, status: "Pending", comments: `${step.reason}\nSLA escalated: ${target.reason}` }
      }),
      prisma.request.update({ where: { id: step.requestId }, data: { status: "Escalated", currentOwnerId: target.employeeId } }),
      prisma.$executeRaw`
        INSERT INTO sla_events
          (sla_event_id, request_id, approval_chain_step_id, event_type, event_at, deadline_at, actor_id, details)
        VALUES
          (${`SLA-${randomUUID()}`}, ${step.requestId}, ${step.stepId}, 'SLA_ESCALATED', ${now}, ${step.slaDeadline}, NULL, ${`Escalated to ${target.name}: ${target.reason}`})
      `,
      prisma.notification.create({
        data: {
          id: `N-${randomUUID()}`,
          requestId: step.requestId,
          recipientEmployeeId: target.employeeId,
          message: `SLA breached: approval for request ${step.requestId} has been escalated to you`,
          status: "Unread",
          createdAt: now
        }
      }),
      prisma.auditLog.create({
        data: {
          id: `AUD-${randomUUID()}`,
          requestId: step.requestId,
          actorId: null,
          eventType: "SLA_ESCALATED",
          eventAt: now,
          details: `Approval step ${step.stepId} escalated to ${target.employeeId}: ${target.reason}`
        }
      })
    ]);
  }

  async markEscalationException(step: SlaApprovalStep, now: Date, reason: string) {
    await prisma.$transaction([
      prisma.request.update({ where: { id: step.requestId }, data: { status: "Routing Exception", currentOwnerId: null } }),
      prisma.$executeRaw`
        INSERT INTO sla_events
          (sla_event_id, request_id, approval_chain_step_id, event_type, event_at, deadline_at, actor_id, details)
        VALUES
          (${`SLA-${randomUUID()}`}, ${step.requestId}, ${step.stepId}, 'SLA_ESCALATION_EXCEPTION', ${now}, ${step.slaDeadline}, NULL, ${reason})
      `,
      prisma.auditLog.create({
        data: {
          id: `AUD-${randomUUID()}`,
          requestId: step.requestId,
          actorId: null,
          eventType: "SLA_ESCALATION_EXCEPTION",
          eventAt: now,
          details: reason
        }
      })
    ]);
  }
}
