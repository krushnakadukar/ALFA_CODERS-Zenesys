import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../http/errors.js";
import { average, calculateBottlenecks, hoursBetween, roundOne } from "../production/analytics.service.js";
import {
  IntelligentRoutingEngine,
  type ApprovalRequirement,
  type ApproverCandidate,
  type ApproverSource,
  type RoutingContext,
  type RoutingEmployee,
  type RoutingPlan,
  type RoutingPolicy,
  type RoutingRepository,
  type RoutingRequest
} from "../production/routing.engine.js";
import type { AuthUser } from "../types.js";
import { priorityFor, proofRequiredFor, requestTypeSchemas } from "./workflow.rules.js";

export async function listRequests(user: AuthUser) {
  const canReadAny = user.permissions.includes("employee:read:any");
  return prisma.request.findMany({
    where: canReadAny
      ? { organizationId: user.organizationId }
      : { organizationId: user.organizationId, OR: [{ employeeId: user.employeeId }, { currentOwnerId: user.employeeId }] },
    include: requestInclude(),
    orderBy: { createdAt: "desc" }
  });
}

export async function getRequest(user: AuthUser, id: string) {
  const request = await prisma.request.findUnique({ where: { id }, include: requestInclude() });
  if (!request || request.organizationId !== user.organizationId) throw new HttpError(404, "Request not found");
  if (!user.permissions.includes("employee:read:any") && request.employeeId !== user.employeeId && request.currentOwnerId !== user.employeeId) {
    throw new HttpError(403, "You cannot view this request");
  }
  return request;
}

export async function createRequest(user: AuthUser, payload: Record<string, unknown>) {
  const type = String(payload.type ?? "");
  if (!requestTypeSchemas.some((schema) => schema.type === type)) throw new HttpError(400, "Unsupported request type");

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: user.employeeId }, include: { manager: true, role: true, department: true, team: true } });
  const id = await nextRequestId();
  const proofRequired = proofRequiredFor(type, payload);
  const priority = priorityFor(type, payload);
  const title = String(payload.title ?? `${type} request`);
  const now = new Date();
  const routingRequest: RoutingRequest = {
    requestId: id,
    organizationId: user.organizationId,
    requesterEmployeeId: user.employeeId,
    requestType: type,
    subType: typeof payload.subType === "string" ? payload.subType : undefined,
    amount: numberOrUndefined(payload.amount ?? payload.estimatedCost),
    currency: typeof payload.currency === "string" ? payload.currency : "INR",
    startDate: dateOrNull(payload.startDate) ?? undefined,
    endDate: dateOrNull(payload.endDate) ?? undefined,
    attributes: payload
  };
  const routingPlan = await new IntelligentRoutingEngine(new PrismaRoutingRepository()).route(routingRequest);
  const firstApproval = routingPlan.status === "PENDING_APPROVAL" ? routingPlan.approvalChain[0] : null;
  const routingExceptionRecipientId =
    routingPlan.status === "ROUTING_EXCEPTION" ? await routingExceptionRecipient(user.organizationId, user.employeeId) : null;

  const request = await prisma.request.create({
    data: {
      id,
      organizationId: user.organizationId,
      employeeId: user.employeeId,
      requestType: type,
      status: routingPlan.status === "ROUTING_EXCEPTION" ? "Routing Exception" : "Pending Approval",
      priority,
      title,
      startDate: dateOrNull(payload.startDate),
      endDate: dateOrNull(payload.endDate),
      reason: String(payload.reason ?? ""),
      createdAt: now,
      currentOwnerId: firstApproval?.approverEmployeeId ?? null,
      context: { create: await buildContextRows(id, employee.id, type, payload) },
      approvals:
        routingPlan.status === "PENDING_APPROVAL"
          ? {
              create: routingPlan.approvalChain
                .filter((step, _index, steps) => step.mode === "Parallel" || step === steps[0])
                .map((step) => ({
                  id: shortId("APR"),
                  approverId: step.approverEmployeeId,
                  stage: step.requirementId,
                  status: "Pending",
                  comments: step.explanation.join("\n")
                }))
            }
          : undefined,
      attachments: proofRequired ? { create: { id: shortId("ATT", 40), fileName: "pending-proof-upload", isRequired: true } } : undefined,
      notifications: {
        create:
          routingPlan.status === "PENDING_APPROVAL"
            ? routingPlan.approvalChain
                .filter((step, _index, steps) => step.mode === "Parallel" || step === steps[0])
                .map((step) => ({
                  id: shortId("N"),
                  recipientEmployeeId: step.approverEmployeeId,
                  message: `Approval required for ${employee.name} ${type} request`,
                  status: "Unread",
                  createdAt: now
                }))
            : [{
                id: shortId("N"),
                recipientEmployeeId: routingExceptionRecipientId ?? user.employeeId,
                message: `Routing exception for ${type} request: ${routingPlan.reason}`,
                status: "Unread",
                createdAt: now
              }]
      },
      auditLogs: {
        create: [
          { id: shortId("AUD"), actorId: user.employeeId, eventType: "REQUEST_SUBMITTED", eventAt: now, details: `${type} request submitted` },
          {
            id: shortId("AUD"),
            actorId: null,
            eventType: routingPlan.status === "ROUTING_EXCEPTION" ? "ROUTING_EXCEPTION" : "ROUTED",
            eventAt: now,
            details: routingPlan.status === "ROUTING_EXCEPTION" ? routingPlan.reason : routingPlan.approvalChain.flatMap((step) => step.explanation).join("\n")
          }
        ]
      }
    },
    include: requestInclude()
  });

  await persistRoutingArtifacts(routingPlan, now);
  return request;
}

export async function approvalInbox(user: AuthUser) {
  await ensureCompanyLeaveBalances(user.organizationId);
  return prisma.approval.findMany({
    where: { approverId: user.employeeId, status: "Pending" },
    include: { request: { include: { employee: { include: { role: true, department: true, team: true, manager: true, leaveBalances: true } }, currentOwner: true, context: true, attachments: true } }, approver: true },
    orderBy: { request: { createdAt: "desc" } }
  });
}

export async function decideApproval(user: AuthUser, approvalId: string, decision: "Approved" | "Rejected" | "Sent Back" | "Information Requested", comments?: string) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId }, include: { request: { include: { context: true } } } });
  if (!approval) throw new HttpError(404, "Approval not found");
  if (approval.approverId !== user.employeeId && !user.permissions.includes("employee:read:any")) {
    throw new HttpError(403, "You cannot decide this approval");
  }
  if (approval.status !== "Pending") throw new HttpError(409, "Approval is no longer pending");

  const now = new Date();
  const updated = await prisma.approval.update({ where: { id: approvalId }, data: { status: decision, comments, actionAt: now } });
  await markApprovalChainStep(approval.requestId, approval.approverId, approval.stage, decision, now);

  if (decision === "Approved") {
    const nextStep = await activateNextApprovalStep(approval.requestId, now);
    await prisma.auditLog.create({
      data: {
        id: shortId("AUD"),
        requestId: approval.requestId,
        actorId: user.employeeId,
        eventType: nextStep ? "APPROVED_STEP_ADVANCED" : "APPROVED",
        eventAt: now,
        details: comments ?? `${approval.stage} approved`
      }
    });
    if (nextStep) {
      await prisma.request.update({ where: { id: approval.requestId }, data: { status: "Pending Approval", currentOwnerId: nextStep.approverId } });
      await prisma.approval.create({
        data: {
          id: shortId("APR"),
          requestId: approval.requestId,
          approverId: nextStep.approverId,
          stage: nextStep.requirementId,
          status: "Pending",
          comments: nextStep.reason
        }
      });
      await prisma.notification.create({
        data: {
          id: shortId("N"),
          requestId: approval.requestId,
          recipientEmployeeId: nextStep.approverId,
          message: `Approval required for request ${approval.requestId}`,
          status: "Unread",
          createdAt: now
        }
      });
      return updated;
    }
  }

  const requestStatus =
    decision === "Approved"
      ? "Approved"
      : decision === "Rejected"
        ? "Rejected"
        : decision === "Sent Back"
          ? "Sent Back"
          : "Information Requested";
  const updates: Prisma.PrismaPromise<unknown>[] = [
    prisma.request.update({ where: { id: approval.requestId }, data: { status: requestStatus, currentOwnerId: null } }),
    prisma.auditLog.create({ data: { id: shortId("AUD"), requestId: approval.requestId, actorId: user.employeeId, eventType: normalizePolicyKey(decision), eventAt: now, details: comments ?? `${approval.stage} ${decision}` } }),
    prisma.notification.create({ data: { id: shortId("N"), requestId: approval.requestId, recipientEmployeeId: approval.request.employeeId, message: `Request ${approval.requestId} ${decision.toLowerCase()}`, status: "Unread", createdAt: now } })
  ];
  await prisma.$transaction(updates);
  if (requestStatus === "Approved" && approval.request.requestType === "Leave") {
    await leaveBalanceUpdate(approval.request.employeeId, approval.request.startDate, approval.request.endDate, approval.request.context);
  }
  return updated;
}

export async function delegateApproval(user: AuthUser, approvalId: string, delegateEmployeeId: string, comments?: string) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId }, include: { request: true, approver: true } });
  if (!approval) throw new HttpError(404, "Approval not found");
  if (approval.approverId !== user.employeeId && !user.permissions.includes("employee:read:any")) {
    throw new HttpError(403, "You cannot delegate this approval");
  }
  if (delegateEmployeeId === approval.request.employeeId) throw new HttpError(400, "Requester cannot receive delegated approval");

  const delegate = await prisma.employee.findUnique({ where: { id: delegateEmployeeId }, include: { role: true } });
  if (!delegate || delegate.organizationId !== approval.request.organizationId || delegate.employmentStatus !== "Active" || delegate.availabilityStatus !== "Available") {
    throw new HttpError(400, "Delegate is not an available active approver in this organization");
  }
  if (!isAuthorityRole(delegate.role.name)) throw new HttpError(400, "Delegate is not an authorized approver role");

  const now = new Date();
  const updated = await prisma.approval.update({ where: { id: approvalId }, data: { approverId: delegateEmployeeId, comments, status: "Pending" } });
  await prisma.$transaction([
    prisma.request.update({ where: { id: approval.requestId }, data: { status: "Delegated", currentOwnerId: delegateEmployeeId } }),
    prisma.auditLog.create({ data: { id: shortId("AUD"), requestId: approval.requestId, actorId: user.employeeId, eventType: "DELEGATED", eventAt: now, details: comments ?? `Delegated approval from ${approval.approverId} to ${delegateEmployeeId}` } }),
    prisma.notification.create({ data: { id: shortId("N"), requestId: approval.requestId, recipientEmployeeId: delegateEmployeeId, message: `Approval delegated to you for request ${approval.requestId}`, status: "Unread", createdAt: now } })
  ]);
  await reassignApprovalChainStep(approval.requestId, approval.approverId, delegateEmployeeId, now);
  return updated;
}

export async function resourceRecommendations(skillName: string) {
  const employees = await prisma.employee.findMany({
    where: { employmentStatus: "Active" },
    include: { skills: { include: { skill: true } }, projectMemberships: true, leaveBalances: true, team: true, department: true }
  });

  return employees
    .map((employee) => {
      const skill = employee.skills.find((item) => item.skill.name.toLowerCase() === skillName.toLowerCase());
      const skillScore = skill?.proficiency ?? 0;
      const allocation = employee.projectMemberships.reduce((sum, item) => sum + Number(item.allocationPct), 0);
      const availability = employee.availabilityStatus === "Available" ? 100 : 60;
      const score = Math.round(skillScore * 0.4 + availability * 0.25 + Math.max(0, 100 - allocation) * 0.2 + 15);
      return { employee, skillScore, allocation, availability, score };
    })
    .filter((item) => item.skillScore > 0)
    .sort((a, b) => b.score - a.score);
}

export async function analytics(user: AuthUser) {
  const [requests, approvals, employees, notifications, chainRows, slaRows, utilizationRows] = await Promise.all([
    prisma.request.findMany({ where: { organizationId: user.organizationId } }),
    prisma.approval.findMany(),
    prisma.employee.count({ where: { organizationId: user.organizationId } }),
    prisma.notification.findMany({ where: { status: "Unread" } }),
    approvalChainAnalytics(user.organizationId),
    slaAnalytics(user.organizationId),
    utilizationAnalytics(user.organizationId)
  ]);
  const terminalRequests = requests.filter((item) => ["Approved", "Rejected", "Completed"].includes(item.status));
  const openRequests = requests.filter((item) => !["Approved", "Rejected", "Completed", "Cancelled"].includes(item.status));
  const turnaroundHours = average(
    terminalRequests.map((request) => {
      const latestAction = approvals
        .filter((approval) => approval.requestId === request.id && approval.actionAt)
        .map((approval) => approval.actionAt!.getTime())
        .sort((left, right) => right - left)[0];
      return latestAction ? hoursBetween(request.createdAt, new Date(latestAction)) : null;
    })
  );
  const volumeByType = requests.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.requestType]: (acc[item.requestType] ?? 0) + 1 }), {});
  const volumeByStatus = requests.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
  const pendingByStage = approvals
    .filter((item) => item.status === "Pending")
    .reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.stage]: (acc[item.stage] ?? 0) + 1 }), {});
  const breachCount = slaRows.filter((item) => item.eventType === "SLA_BREACHED").length;
  const escalationCount = slaRows.filter((item) => item.eventType === "SLA_ESCALATED").length;
  const totalSlaEvents = slaRows.filter((item) => item.eventType === "SLA_BREACHED" || item.eventType === "SLA_ESCALATED" || item.eventType === "SLA_REMINDER").length;
  const workload = chainRows
    .filter((item) => ["PENDING", "SLA_REMINDER_SENT", "SLA_BREACHED", "ESCALATED"].includes(item.status))
    .reduce<Record<string, { employeeId: string; employeeName: string; pendingApprovals: number; breachedApprovals: number }>>((acc, item) => {
      const current = acc[item.approverId] ?? { employeeId: item.approverId, employeeName: item.approverName, pendingApprovals: 0, breachedApprovals: 0 };
      current.pendingApprovals += 1;
      if (item.status === "SLA_BREACHED" || item.status === "ESCALATED") current.breachedApprovals += 1;
      acc[item.approverId] = current;
      return acc;
    }, {});
  return {
    employees,
    openRequests: openRequests.length,
    escalated: requests.filter((item) => item.status === "Escalated").length + escalationCount,
    critical: requests.filter((item) => item.priority === "Critical").length,
    unreadNotifications: notifications.length,
    requestVolume: {
      total: requests.length,
      byType: volumeByType,
      byStatus: volumeByStatus
    },
    turnaround: {
      completedCount: terminalRequests.length,
      averageHours: roundOne(turnaroundHours)
    },
    sla: {
      events: totalSlaEvents,
      breaches: breachCount,
      escalations: escalationCount,
      compliancePct: totalSlaEvents === 0 ? 100 : roundOne(((totalSlaEvents - breachCount) / totalSlaEvents) * 100)
    },
    workload: Object.values(workload).sort((left, right) => right.pendingApprovals - left.pendingApprovals),
    utilization: {
      averageAllocationPct: roundOne(average(utilizationRows.map((item) => item.allocationPct))),
      overAllocatedEmployees: utilizationRows.filter((item) => item.allocationPct > 100).length,
      employees: utilizationRows
    },
    pendingByStage,
    bottlenecks: bottlenecksFromChain(chainRows)
  };
}

export async function governance() {
  const [roles, auditLogs, notifications] = await Promise.all([
    prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } }, orderBy: { id: "asc" } }),
    prisma.auditLog.findMany({ include: { actor: true }, orderBy: { eventAt: "desc" }, take: 50 }),
    prisma.notification.findMany({ include: { recipient: true }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);
  return { roles, auditLogs, notifications };
}

export function classifyPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  const type = classifyRequestType(lower);
  return { type, confidence: 0.91, route: requestTypeSchemas.find((schema) => schema.type === type)?.route, fields: requestTypeSchemas.find((schema) => schema.type === type)?.fields };
}

function requestInclude() {
  return {
    employee: { include: { role: true, department: true, team: true, manager: true } },
    currentOwner: true,
    context: true,
    approvals: true,
    attachments: true,
    notifications: true,
    auditLogs: { include: { actor: true }, orderBy: { eventAt: "asc" } }
  } satisfies Prisma.RequestInclude;
}

async function buildContextRows(_requestId: string, employeeId: string, type: string, payload: Record<string, unknown>) {
  const [employee, leaveBalances, memberships] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { manager: true, department: true, team: true } }),
    ensureEmployeeLeaveBalances(employeeId),
    prisma.projectMember.findMany({ where: { employeeId }, include: { project: true } })
  ]);
  const workload = memberships.reduce((sum, item) => sum + Number(item.allocationPct), 0);
  const rows = [
    { key: "employee", value: `${employee.designation}; manager ${employee.manager?.name ?? "None"}; team ${employee.team?.name ?? "None"}`, sourceType: "Employee master" },
    { key: "employee_email", value: employee.email ?? "No email on employee profile", sourceType: "Employee master" },
    { key: "workload", value: `${workload}% allocated across active projects`, sourceType: "ERP" },
    { key: "policy_route", value: requestTypeSchemas.find((schema) => schema.type === type)?.route ?? "Direct Manager", sourceType: "Rules" },
    { key: "proof", value: proofRequiredFor(type, payload) ? "Required" : "Optional", sourceType: "Policy" },
    { key: "leave_balance", value: leaveBalances.map((item) => `${item.availableDays} ${item.leaveType} days`).join("; ") || "No balance record", sourceType: "HR" }
  ];
  if (type === "Leave") rows.push({ key: "leave_type", value: String(payload.leaveType ?? "Annual"), sourceType: "Request" });
  return rows;
}

async function nextRequestId() {
  const latest = await prisma.request.findFirst({
    where: { id: { startsWith: "REQ" } },
    orderBy: { id: "desc" },
    select: { id: true }
  });
  const current = latest ? Number(latest.id.replace(/^REQ/, "")) : 0;
  return `REQ${String(current + 1).padStart(3, "0")}`;
}

export async function ensureCompanyLeaveBalances(organizationId: string) {
  const employees = await prisma.employee.findMany({ where: { organizationId, employmentStatus: "Active" }, select: { id: true } });
  await Promise.all(employees.map((employee) => ensureEmployeeLeaveBalances(employee.id)));
}

export async function ensureEmployeeLeaveBalances(employeeId: string) {
  const existing = await prisma.leaveBalance.findMany({ where: { employeeId } });
  const existingTypes = new Set(existing.map((item) => item.leaveType));
  const defaults = [
    { leaveType: "Annual", entitlement: 12, usedDays: 0, pendingDays: 0, availableDays: 12 },
    { leaveType: "Sick", entitlement: 8, usedDays: 0, pendingDays: 0, availableDays: 8 }
  ];
  const missing = defaults.filter((item) => !existingTypes.has(item.leaveType));
  if (missing.length === 0) return existing;
  await prisma.leaveBalance.createMany({
    data: missing.map((item) => ({
      id: `LB-${employeeId}-${item.leaveType.slice(0, 2).toUpperCase()}`,
      employeeId,
      ...item
    })),
    skipDuplicates: true
  });
  return prisma.leaveBalance.findMany({ where: { employeeId } });
}

async function leaveBalanceUpdate(employeeId: string, startDate?: Date | null, endDate?: Date | null, context: Array<{ key: string; value: string | null }> = []) {
  const balances = await ensureEmployeeLeaveBalances(employeeId);
  const leaveType = context.find((item) => item.key === "leave_type")?.value ?? "Annual";
  const balance = balances.find((item) => item.leaveType === leaveType) ?? balances[0];
  if (!balance) return null;
  const days = approvedLeaveDays(startDate, endDate);
  return prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      usedDays: balance.usedDays + days,
      pendingDays: Math.max(0, balance.pendingDays - days),
      availableDays: Math.max(0, balance.availableDays - days)
    }
  });
}

function approvedLeaveDays(startDate?: Date | null, endDate?: Date | null) {
  if (!startDate || !endDate) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1);
}

function dateOrNull(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : null;
}

function numberOrUndefined(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

type ApprovalChainAnalyticsRow = {
  stepId: string;
  requestId: string;
  approverId: string;
  approverName: string;
  approverSource: string;
  status: string;
  createdAt: Date;
  actionAt: Date | null;
  slaDeadline: Date | null;
};

type SlaAnalyticsRow = {
  eventType: string;
  requestId: string;
  eventAt: Date;
};

type UtilizationAnalyticsRow = {
  employeeId: string;
  employeeName: string;
  allocationPct: number;
};

async function approvalChainAnalytics(organizationId: string) {
  try {
    return await prisma.$queryRaw<ApprovalChainAnalyticsRow[]>`
      SELECT
        acs.approval_chain_step_id AS stepId,
        acs.request_id AS requestId,
        acs.approver_id AS approverId,
        approver.name AS approverName,
        acs.approver_source AS approverSource,
        acs.status,
        acs.created_at AS createdAt,
        acs.action_at AS actionAt,
        acs.sla_deadline AS slaDeadline
      FROM approval_chain_steps acs
      INNER JOIN requests r ON r.request_id = acs.request_id
      INNER JOIN employees approver ON approver.employee_id = acs.approver_id
      WHERE r.organization_id = ${organizationId}
    `;
  } catch {
    return [];
  }
}

async function slaAnalytics(organizationId: string) {
  try {
    return await prisma.$queryRaw<SlaAnalyticsRow[]>`
      SELECT se.event_type AS eventType, se.request_id AS requestId, se.event_at AS eventAt
      FROM sla_events se
      INNER JOIN requests r ON r.request_id = se.request_id
      WHERE r.organization_id = ${organizationId}
    `;
  } catch {
    return [];
  }
}

async function utilizationAnalytics(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ employeeId: string; employeeName: string; allocationPct: Prisma.Decimal | number | string | null }>>`
    SELECT
      e.employee_id AS employeeId,
      e.name AS employeeName,
      COALESCE(SUM(pm.allocation_pct), 0) AS allocationPct
    FROM employees e
    LEFT JOIN project_members pm ON pm.employee_id = e.employee_id
    WHERE e.organization_id = ${organizationId}
      AND e.employment_status = 'Active'
    GROUP BY e.employee_id, e.name
    ORDER BY allocationPct DESC
  `;
  return rows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    allocationPct: Number(decimalToNumber(row.allocationPct) ?? 0)
  }));
}

function bottlenecksFromChain(rows: ApprovalChainAnalyticsRow[]) {
  return calculateBottlenecks(rows);
}

class PrismaRoutingRepository implements RoutingRepository {
  async buildContext(request: RoutingRequest): Promise<RoutingContext> {
    const requester = await prisma.employee.findUniqueOrThrow({
      where: { id: request.requesterEmployeeId },
      include: {
        role: true,
        department: true,
        team: true,
        manager: { include: { role: true, department: true, team: true } },
        projectMemberships: true,
        leaveBalances: true
      }
    });
    const workload = requester.projectMemberships.reduce((sum, item) => sum + Number(item.allocationPct), 0);
    return {
      request,
      requester: routingEmployee(requester),
      submittedSnapshot: {
        requesterEmployeeId: requester.id,
        name: requester.name,
        role: requester.role.name,
        designation: requester.designation,
        departmentId: requester.departmentId,
        department: requester.department?.name,
        teamId: requester.teamId,
        team: requester.team?.name,
        managerEmployeeId: requester.managerId,
        manager: requester.manager?.name,
        businessUnit: requester.businessUnit,
        employmentStatus: requester.employmentStatus,
        availabilityStatus: requester.availabilityStatus,
        workload
      },
      facts: {
        requesterManager: requester.manager ? routingEmployee(requester.manager) : null,
        leaveBalances: requester.leaveBalances,
        workload
      }
    };
  }

  async loadPolicy(context: RoutingContext): Promise<RoutingPolicy | null> {
    const policy = await loadConfiguredPolicy(context);
    if (policy) return policy;
    return {
      policyId: `DEFAULT-${normalizePolicyKey(context.request.requestType)}`,
      version: 1,
      requestType: context.request.requestType,
      requirements: requirementsFor(context)
    };
  }

  async discoverApprovers(requirement: ApprovalRequirement, context: RoutingContext): Promise<ApproverCandidate[]> {
    switch (requirement.source) {
      case "DIRECT_MANAGER":
        return this.directManager(context);
      case "DEPARTMENT_HEAD":
        return this.departmentAuthority(context, ["Department Head", "Senior Manager"]);
      case "HR":
        return this.departmentNamed(context, "Human Resources", "HR approval required by policy");
      case "FINANCE":
        return this.departmentNamed(context, "Finance", "Finance authority required by policy");
      case "IT":
        return this.departmentNamed(context, "Information Security", "IT/security authority required by policy");
      case "PROCUREMENT":
        return this.departmentNamed(context, "Administration", "Procurement/admin authority required by policy");
      case "PROJECT_MANAGER":
        return this.projectManager(context);
      case "BUSINESS_UNIT_HEAD":
        return this.executiveAuthority(context);
      case "FUNCTIONAL_MANAGER":
      case "MATRIX_MANAGER":
      case "DIVISION_HEAD":
      case "DELEGATED_APPROVER":
      case "POSITION_OWNER":
        return [];
    }
  }

  async findValidDelegation(candidate: ApproverCandidate, _requirement: ApprovalRequirement, context: RoutingContext) {
    return findConfiguredDelegation(candidate, context);
  }

  async findNextAuthorizedSuperior(candidate: ApproverCandidate, requirement: ApprovalRequirement, context: RoutingContext): Promise<ApproverCandidate | null> {
    const managerId = candidate.employee.managerEmployeeId;
    if (!managerId) return null;
    const manager = await prisma.employee.findUnique({
      where: { id: managerId },
      include: { role: true, department: true, team: true }
    });
    if (!manager) return null;
    return {
      employee: routingEmployee(manager),
      source: requirement.source,
      reason: `${candidate.employee.name} was rejected; next authorized hierarchy level is ${manager.name}`
    };
  }

  async findPolicyAlternate(requirement: ApprovalRequirement, context: RoutingContext): Promise<ApproverCandidate | null> {
    if (requirement.source !== "DIRECT_MANAGER") return null;
    const candidates = await this.departmentAuthority(context, ["Department Head", "Senior Manager"]);
    return candidates[0] ?? null;
  }

  async evaluateConflicts(candidate: ApproverCandidate, _requirement: ApprovalRequirement, context: RoutingContext): Promise<string[]> {
    const conflicts = [];
    if (candidate.employee.employeeId === context.request.attributes.resourceOwnerId) {
      conflicts.push("Approver owns the requested resource");
    }
    if (candidate.employee.employeeId === context.request.attributes.vendorEmployeeId) {
      conflicts.push("Approver is linked to the request beneficiary/vendor");
    }
    if (candidate.employee.employeeId === context.request.attributes.applicationOwnerId) {
      conflicts.push("Requester cannot approve access where they are also the application owner");
    }
    return conflicts;
  }

  async hasApprovalAuthority(candidate: ApproverCandidate, requirement: ApprovalRequirement, context: RoutingContext): Promise<boolean> {
    if (candidate.employee.organizationId !== context.request.organizationId) return false;
    if (!isAuthorityRole(candidate.employee.role) && !isItSecurityAuthority(candidate.employee, requirement.source)) return false;
    if (requirement.minimumApprovalLimit && context.request.amount) {
      return approvalLimitFor(candidate.employee) >= context.request.amount;
    }
    return true;
  }

  private async directManager(context: RoutingContext) {
    const manager = context.facts.requesterManager as RoutingEmployee | null;
    return manager
      ? [{
          employee: manager,
          source: "DIRECT_MANAGER" as const,
          reason: `${manager.name} is the current reporting manager for ${context.requester.name}`
        }]
      : [];
  }

  private async departmentAuthority(context: RoutingContext, roleNames: string[]) {
    if (!context.requester.departmentId) return [];
    const employees = await prisma.employee.findMany({
      where: {
        organizationId: context.request.organizationId,
        departmentId: context.requester.departmentId,
        employmentStatus: "Active",
        role: { name: { in: roleNames } }
      },
      include: { role: true, department: true, team: true, approvals: { where: { status: "Pending" } } },
      orderBy: { name: "asc" }
    });
    return employees
      .sort((left, right) => left.approvals.length - right.approvals.length)
      .map((employee) => ({
        employee: routingEmployee(employee, employee.approvals.length),
        source: "DEPARTMENT_HEAD" as const,
        reason: `${employee.name} is an authorized department authority for ${context.requester.departmentId}`
      }));
  }

  private async departmentNamed(context: RoutingContext, departmentName: string, reason: string) {
    const employees = await prisma.employee.findMany({
      where: {
        organizationId: context.request.organizationId,
        employmentStatus: "Active",
        department: { name: departmentName },
        OR: [
          { role: { level: { in: ["Executive", "Management"] } } },
          ...(departmentName === "Information Security"
            ? [{ role: { name: { contains: "Security" } } }, { designation: { contains: "Security" } }]
            : [])
        ]
      },
      include: { role: true, department: true, team: true, approvals: { where: { status: "Pending" } } },
      orderBy: { name: "asc" }
    });
    return employees
      .sort((left, right) => left.approvals.length - right.approvals.length)
      .map((employee) => ({
        employee: routingEmployee(employee, employee.approvals.length),
        source: sourceForDepartment(departmentName),
        reason
      }));
  }

  private async projectManager(context: RoutingContext) {
    const projectId = typeof context.request.attributes.projectId === "string" ? context.request.attributes.projectId : null;
    if (!projectId) return this.directManager(context);
    const members = await prisma.projectMember.findMany({
      where: { projectId, projectRole: { contains: "Manager" } },
      include: { employee: { include: { role: true, department: true, team: true, approvals: { where: { status: "Pending" } } } } },
      orderBy: { employeeId: "asc" }
    });
    return members.map((member) => ({
      employee: routingEmployee(member.employee, member.employee.approvals.length),
      source: "PROJECT_MANAGER" as const,
      reason: `${member.employee.name} is a project manager for ${projectId}`
    }));
  }

  private async executiveAuthority(context: RoutingContext) {
    const employees = await prisma.employee.findMany({
      where: {
        organizationId: context.request.organizationId,
        employmentStatus: "Active",
        role: { level: "Executive" }
      },
      include: { role: true, department: true, team: true, approvals: { where: { status: "Pending" } } },
      orderBy: { name: "asc" }
    });
    return employees.map((employee) => ({
      employee: routingEmployee(employee, employee.approvals.length),
      source: "BUSINESS_UNIT_HEAD" as const,
      reason: `${employee.name} is an executive authority for the organization`
    }));
  }
}

function requirementsFor(context: RoutingContext): ApprovalRequirement[] {
  const amount = context.request.amount ?? 0;
  const days = requestDays(context.request);
  const type = normalizePolicyKey(context.request.requestType);
  const requirements: ApprovalRequirement[] = [];
  const add = (source: ApproverSource, label: string, reasons: string[], minimumApprovalLimit?: number) => {
    requirements.push({
      requirementId: `${requirements.length + 1}-${source}`,
      source,
      label,
      sequence: requirements.length + 1,
      mode: "Sequential",
      minimumApprovalLimit,
      slaMinutes: slaMinutesFor(type),
      policyReasons: reasons
    });
  };

  if (["LEAVE", "WORK_FROM_HOME", "ATTENDANCE_CORRECTION", "REMOTE_WORK", "OVERTIME_REQUEST", "SHIFT_CHANGE", "TIMESHEET_CORRECTION"].includes(type)) {
    add("DIRECT_MANAGER", "Manager Approval", [`${context.request.requestType} requires line-management approval`]);
    if (days > 3) add("DEPARTMENT_HEAD", "Department Approval", [`Duration ${days} days exceeds department review threshold`]);
    if (days > 7 || type === "OVERTIME_REQUEST") add("HR", "HR Approval", [`${context.request.requestType} requires HR policy validation`]);
    return requirements;
  }

  if (["EXPENSE", "EXPENSE_REIMBURSEMENT", "TRAVEL", "PURCHASE_REQUEST", "TRAINING_REQUEST"].includes(type)) {
    add("DIRECT_MANAGER", "Manager Approval", [`${context.request.requestType} requires requester management approval`], Math.min(amount || 1, 50000));
    if (amount > 50000 || ["PURCHASE_REQUEST", "TRAVEL"].includes(type)) {
      add("DEPARTMENT_HEAD", "Department Approval", [`Amount ${amount} requires department authority`], amount);
    }
    if (amount > 10000 || ["PURCHASE_REQUEST", "TRAVEL"].includes(type)) {
      add("FINANCE", "Finance Approval", [`Amount ${amount} requires finance approval`], amount);
    }
    if (type === "PURCHASE_REQUEST") add("PROCUREMENT", "Procurement Approval", ["Purchase requests require procurement handling"]);
    if (type === "TRAINING_REQUEST" && amount > 25000) add("HR", "HR/L&D Approval", ["Training cost exceeds L&D review threshold"]);
    return requirements;
  }

  if (["EQUIPMENT", "ASSET_REQUEST", "IT_ACCESS_REQUEST", "SOFTWARE_ACCESS"].includes(type)) {
    add("DIRECT_MANAGER", "Manager Approval", [`${context.request.requestType} requires business justification approval`]);
    add("IT", "IT/Security Approval", [`${context.request.requestType} requires IT or security validation`]);
    if (amount > 50000) add("FINANCE", "Finance Approval", [`Asset/access cost ${amount} exceeds finance threshold`], amount);
    return requirements;
  }

  if (["RESOURCE_ALLOCATION", "RESOURCE_REQUEST", "PROJECT_ALLOCATION"].includes(type)) {
    add("PROJECT_MANAGER", "Project Approval", ["Resource requests require project authority"]);
    add("DEPARTMENT_HEAD", "Resource Owner Approval", ["Resource capacity requires department/resource owner validation"]);
    return requirements;
  }

  if (["TRANSFER", "TRANSFER_REQUEST", "PROMOTION_REQUEST", "SALARY_REVISION", "RESIGNATION", "EMPLOYEE_DATA_CHANGE"].includes(type)) {
    add("DIRECT_MANAGER", "Manager Approval", [`${context.request.requestType} requires management approval`]);
    add("DEPARTMENT_HEAD", "Department Approval", [`${context.request.requestType} requires department authority`]);
    add("HR", "HR Approval", [`${context.request.requestType} requires HR validation`]);
    if (type === "SALARY_REVISION") add("FINANCE", "Finance Approval", ["Salary changes require finance validation"]);
    return requirements;
  }

  add("DIRECT_MANAGER", "Manager Approval", [`${context.request.requestType} uses default policy-driven manager review`]);
  return requirements;
}

type PolicyRow = {
  id: string;
  version: number;
  name: string;
};

type RequirementRow = {
  id: string;
  requirementKey: string;
  source: string;
  label: string;
  sequence: number;
  mode: string;
  conditionAmountGt: Prisma.Decimal | number | string | null;
  conditionDurationGt: number | null;
  minimumApprovalLimit: Prisma.Decimal | number | string | null;
  slaMinutes: number | null;
  policyReasonsJson: string;
};

async function loadConfiguredPolicy(context: RoutingContext): Promise<RoutingPolicy | null> {
  const requestTypeKey = normalizePolicyKey(context.request.requestType);
  try {
    const policies = await prisma.$queryRaw<PolicyRow[]>`
      SELECT routing_policy_id AS id, version, name
      FROM routing_policy_configs
      WHERE organization_id = ${context.request.organizationId}
        AND request_type_key = ${requestTypeKey}
        AND active = true
      ORDER BY version DESC
      LIMIT 1
    `;
    const policy = policies[0];
    if (!policy) return null;

    const rows = await prisma.$queryRaw<RequirementRow[]>`
      SELECT
        approval_requirement_id AS id,
        requirement_key AS requirementKey,
        source,
        label,
        step_sequence AS sequence,
        mode,
        condition_amount_gt AS conditionAmountGt,
        condition_duration_days_gt AS conditionDurationGt,
        minimum_approval_limit AS minimumApprovalLimit,
        sla_minutes AS slaMinutes,
        policy_reasons_json AS policyReasonsJson
      FROM approval_requirement_configs
      WHERE routing_policy_id = ${policy.id}
        AND active = true
      ORDER BY step_sequence ASC
    `;
    const amount = context.request.amount ?? 0;
    const days = requestDays(context.request);
    const requirements = rows
      .filter((row) => {
        const amountGt = decimalToNumber(row.conditionAmountGt);
        if (amountGt != null && !(amount > amountGt)) return false;
        if (row.conditionDurationGt != null && !(days > row.conditionDurationGt)) return false;
        return true;
      })
      .map((row) => ({
        requirementId: row.requirementKey,
        source: row.source as ApproverSource,
        label: row.label,
        sequence: row.sequence,
        mode: row.mode === "Parallel" ? "Parallel" as const : "Sequential" as const,
        minimumApprovalLimit: decimalToNumber(row.minimumApprovalLimit),
        slaMinutes: row.slaMinutes ?? undefined,
        policyReasons: parseStringArray(row.policyReasonsJson, [`Configured policy ${policy.name}`])
      }));
    return {
      policyId: policy.id,
      version: policy.version,
      requestType: context.request.requestType,
      requirements
    };
  } catch {
    return null;
  }
}

type DelegationRow = {
  delegateId: string;
  reason: string;
};

async function findConfiguredDelegation(candidate: ApproverCandidate, context: RoutingContext) {
  try {
    const rows = await prisma.$queryRaw<DelegationRow[]>`
      SELECT delegate_id AS delegateId, reason
      FROM delegation_rules
      WHERE organization_id = ${context.request.organizationId}
        AND delegator_id = ${candidate.employee.employeeId}
        AND active = true
        AND start_at <= NOW()
        AND end_at >= NOW()
        AND (department_id IS NULL OR department_id = ${context.requester.departmentId ?? null})
      ORDER BY end_at ASC
      LIMIT 5
    `;
    for (const row of rows) {
      const requestTypes = await delegationRequestTypes(candidate.employee.employeeId, row.delegateId);
      if (requestTypes.length > 0 && !requestTypes.includes(normalizePolicyKey(context.request.requestType))) continue;
      const delegate = await prisma.employee.findUnique({ where: { id: row.delegateId }, include: { role: true, department: true, team: true } });
      if (!delegate) continue;
      return {
        delegatorEmployeeId: candidate.employee.employeeId,
        delegate: routingEmployee(delegate),
        reason: row.reason
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function delegationRequestTypes(delegatorId: string, delegateId: string) {
  const rows = await prisma.$queryRaw<Array<{ requestTypesJson: string }>>`
    SELECT request_types_json AS requestTypesJson
    FROM delegation_rules
    WHERE delegator_id = ${delegatorId}
      AND delegate_id = ${delegateId}
      AND active = true
    ORDER BY end_at ASC
    LIMIT 1
  `;
  return parseStringArray(rows[0]?.requestTypesJson ?? "[]", []);
}

async function persistRoutingArtifacts(plan: RoutingPlan, now: Date) {
  const client = prisma as unknown as {
    approvalChainStep?: { createMany(args: { data: unknown[] }): Promise<unknown> };
    routingDecisionLog?: { create(args: { data: unknown }): Promise<unknown> };
  };
  if (plan.status === "PENDING_APPROVAL" && client.approvalChainStep) {
    await client.approvalChainStep.createMany({
      data: plan.approvalChain.map((step, index) => ({
        id: step.stepId,
        requestId: plan.decisionLog.requestId,
        sequence: index + 1,
        approverId: step.approverEmployeeId,
        approverSource: step.source,
        roleLabel: step.approverRole,
        status: index === 0 || step.mode === "Parallel" ? "PENDING" : "WAITING",
        reason: step.explanation.join("\n"),
        slaDeadline: step.slaMinutes ? new Date(now.getTime() + step.slaMinutes * 60_000) : null,
        createdAt: now
      }))
    });
  }
  if (client.routingDecisionLog) {
    await client.routingDecisionLog.create({
      data: {
        id: `RDL-${randomUUID()}`,
        requestId: plan.decisionLog.requestId,
        routingTimestamp: plan.decisionLog.routingTimestamp,
        routingEngineVersion: plan.decisionLog.routingEngineVersion,
        policyId: plan.status === "PENDING_APPROVAL" ? plan.policyId : plan.policyId ?? null,
        policyVersion: plan.decisionLog.policyVersion,
        status: plan.status,
        requesterContext: JSON.stringify(plan.decisionLog.requesterContext),
        candidateApprovers: JSON.stringify(plan.decisionLog.candidateApprovers),
        rejectedCandidates: JSON.stringify(plan.decisionLog.rejectedCandidates),
        selectedApprovers: JSON.stringify(plan.decisionLog.selectedApprovers),
        rulesEvaluated: JSON.stringify(plan.decisionLog.rulesEvaluated),
        exceptionReason: plan.status === "ROUTING_EXCEPTION" ? plan.reason : null
      }
    });
  }
}

async function routingExceptionRecipient(organizationId: string, fallbackEmployeeId: string) {
  const recipient = await prisma.employee.findFirst({
    where: {
      organizationId,
      employmentStatus: "Active",
      availabilityStatus: "Available",
      OR: [
        { role: { name: "Admin Executive" } },
        { role: { name: "CHRO" } },
        { department: { name: "Human Resources" } }
      ]
    },
    include: { role: true },
    orderBy: { name: "asc" }
  });
  return recipient?.id ?? fallbackEmployeeId;
}

function routingEmployee(
  employee: {
    id: string;
    organizationId: string;
    name: string;
    role?: { name: string; level?: string | null } | null;
    designation?: string | null;
    departmentId?: string | null;
    teamId?: string | null;
    businessUnit?: string | null;
    managerId?: string | null;
    employmentStatus: string;
    availabilityStatus: string;
  },
  pendingApprovals = 0
): RoutingEmployee {
  return {
    employeeId: employee.id,
    organizationId: employee.organizationId,
    name: employee.name,
    role: employee.role?.name,
    designation: employee.designation,
    departmentId: employee.departmentId,
    teamId: employee.teamId,
    businessUnitId: employee.businessUnit,
    managerEmployeeId: employee.managerId,
    employmentStatus: employee.employmentStatus,
    availabilityState: availabilityStateFor(employee),
    approvalLimit: approvalLimitFor({ role: employee.role?.name, designation: employee.designation }),
    currency: "INR",
    pendingApprovals
  };
}

async function markApprovalChainStep(requestId: string, approverId: string, requirementId: string, decision: string, now: Date) {
  await prisma.$executeRaw`
    UPDATE approval_chain_steps
    SET status = ${normalizePolicyKey(decision)}, action_at = ${now}
    WHERE request_id = ${requestId}
      AND approver_id = ${approverId}
      AND approval_chain_step_id = ${`${requestId}-${requirementId}`}
  `;
}

async function activateNextApprovalStep(requestId: string, now: Date) {
  const rows = await prisma.$queryRaw<Array<{ id: string; approverId: string; requirementId: string; reason: string }>>`
    SELECT
      approval_chain_step_id AS id,
      approver_id AS approverId,
      SUBSTRING(approval_chain_step_id, LENGTH(${requestId}) + 2) AS requirementId,
      reason
    FROM approval_chain_steps
    WHERE request_id = ${requestId}
      AND status = 'WAITING'
    ORDER BY step_sequence ASC
    LIMIT 1
  `;
  const nextStep = rows[0];
  if (!nextStep) return null;
  await prisma.$executeRaw`
    UPDATE approval_chain_steps
    SET status = 'PENDING', created_at = ${now}
    WHERE approval_chain_step_id = ${nextStep.id}
  `;
  return nextStep;
}

async function reassignApprovalChainStep(requestId: string, previousApproverId: string, delegateEmployeeId: string, now: Date) {
  await prisma.$executeRaw`
    UPDATE approval_chain_steps
    SET approver_id = ${delegateEmployeeId},
        approver_source = 'DELEGATED_APPROVER',
        status = 'PENDING',
        created_at = ${now}
    WHERE request_id = ${requestId}
      AND approver_id = ${previousApproverId}
      AND status = 'PENDING'
  `;
}

function availabilityStateFor(employee: { employmentStatus: string; availabilityStatus: string }) {
  if (employee.employmentStatus !== "Active") return "INACTIVE";
  if (employee.availabilityStatus === "On Leave") return "ON_LEAVE";
  if (employee.availabilityStatus === "Unavailable") return "OUT_OF_OFFICE";
  if (employee.availabilityStatus === "Suspended") return "SUSPENDED";
  if (employee.availabilityStatus === "Available") return "AVAILABLE";
  return "UNKNOWN";
}

function approvalLimitFor(employee: { role?: string | null; designation?: string | null; approvalLimit?: number | null }) {
  if (employee.approvalLimit != null) return employee.approvalLimit;
  const text = `${employee.role ?? ""} ${employee.designation ?? ""}`.toLowerCase();
  if (text.includes("ceo") || text.includes("cto") || text.includes("cfo") || text.includes("chief")) return 1_000_000;
  if (text.includes("head")) return 500_000;
  if (text.includes("senior manager")) return 250_000;
  if (text.includes("manager") || text.includes("lead")) return 100_000;
  return 0;
}

function isAuthorityRole(role?: string | null) {
  if (!role) return false;
  return /manager|lead|head|ceo|cto|cfo|chro|coo|cmo|executive/i.test(role);
}

function isItSecurityAuthority(employee: { role?: string | null; designation?: string | null; departmentId?: string | null }, source: ApproverSource) {
  if (source !== "IT") return false;
  const text = `${employee.role ?? ""} ${employee.designation ?? ""}`.toLowerCase();
  return employee.departmentId === "D007" && /security|it|devops/.test(text);
}

function requestDays(request: RoutingRequest) {
  if (!request.startDate || !request.endDate) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((request.endDate.getTime() - request.startDate.getTime()) / dayMs) + 1);
}

function normalizePolicyKey(type: string) {
  return type.trim().replaceAll(" ", "_").toUpperCase();
}

function slaMinutesFor(type: string) {
  if (["LEAVE", "WORK_FROM_HOME", "IT_ACCESS_REQUEST", "SOFTWARE_ACCESS"].includes(type)) return 24 * 60;
  if (["EXPENSE", "EXPENSE_REIMBURSEMENT", "TRAVEL"].includes(type)) return 48 * 60;
  if (["PURCHASE_REQUEST", "ASSET_REQUEST", "EQUIPMENT"].includes(type)) return 72 * 60;
  return 48 * 60;
}

function sourceForDepartment(departmentName: string): ApproverSource {
  if (departmentName === "Finance") return "FINANCE";
  if (departmentName === "Human Resources") return "HR";
  if (departmentName === "Administration") return "PROCUREMENT";
  return "IT";
}

function decimalToNumber(value: Prisma.Decimal | number | string | null) {
  if (value == null) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parseStringArray(value: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

function shortId(prefix: string, maxLength = 20) {
  const compact = randomUUID().replaceAll("-", "");
  const separator = prefix ? "-" : "";
  const available = Math.max(1, maxLength - prefix.length - separator.length);
  return `${prefix}${separator}${compact.slice(0, available)}`;
}

function classifyRequestType(lowerPrompt: string) {
  if (lowerPrompt.includes("resign") || lowerPrompt.includes("notice period")) return "Resignation";
  if (lowerPrompt.includes("salary") || lowerPrompt.includes("compensation")) return "Salary Revision";
  if (lowerPrompt.includes("promotion") || lowerPrompt.includes("designation")) return "Promotion Request";
  if (lowerPrompt.includes("transfer") || lowerPrompt.includes("department change")) return "Transfer Request";
  if (lowerPrompt.includes("timesheet")) return "Timesheet Correction";
  if (lowerPrompt.includes("shift")) return "Shift Change";
  if (lowerPrompt.includes("overtime")) return "Overtime Request";
  if (lowerPrompt.includes("training") || lowerPrompt.includes("course")) return "Training Request";
  if (lowerPrompt.includes("purchase") || lowerPrompt.includes("vendor")) return "Purchase Request";
  if (lowerPrompt.includes("travel") || lowerPrompt.includes("flight") || lowerPrompt.includes("hotel")) return "Travel";
  if (lowerPrompt.includes("expense") || lowerPrompt.includes("receipt") || lowerPrompt.includes("reimbursement")) return "Expense Reimbursement";
  if (lowerPrompt.includes("laptop") || lowerPrompt.includes("asset") || lowerPrompt.includes("equipment")) return "Asset Request";
  if (lowerPrompt.includes("access") || lowerPrompt.includes("aws") || lowerPrompt.includes("permission")) return "IT Access Request";
  if (lowerPrompt.includes("software") || lowerPrompt.includes("license")) return "Software Access";
  if (lowerPrompt.includes("resource") || lowerPrompt.includes("allocation") || lowerPrompt.includes("developer")) return "Resource Request";
  if (lowerPrompt.includes("attendance") || lowerPrompt.includes("punch")) return "Attendance Correction";
  if (lowerPrompt.includes("remote")) return "Remote Work";
  if (lowerPrompt.includes("leave") || lowerPrompt.includes("vacation") || lowerPrompt.includes("sick")) return "Leave";
  if (lowerPrompt.includes("document") || lowerPrompt.includes("letter") || lowerPrompt.includes("certificate")) return "Document Request";
  if (lowerPrompt.includes("bank") || lowerPrompt.includes("address") || lowerPrompt.includes("phone")) return "Employee Data Change";
  return "Work From Home";
}
