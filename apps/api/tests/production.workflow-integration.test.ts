import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../src/types.js";

const prisma = vi.hoisted(() => ({
  employee: {
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
  },
  leaveBalance: { findMany: vi.fn() },
  projectMember: { findMany: vi.fn() },
  request: {
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  approval: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn()
  },
  notification: { create: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn(), findMany: vi.fn() },
  role: { findMany: vi.fn() },
  resource: { findMany: vi.fn() },
  approvalChainStep: { createMany: vi.fn() },
  routingDecisionLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn()
}));

vi.mock("../src/db.js", () => ({ prisma }));

const user: AuthUser = {
  userId: "U1",
  employeeId: "E-REQUESTER",
  organizationId: "ORG1",
  roleId: "R12",
  roleName: "Software Engineer",
  permissions: ["workflow:write", "employee:read:self"],
  roles: []
};

const managerUser: AuthUser = {
  ...user,
  userId: "U-MANAGER",
  employeeId: "E-MANAGER",
  roleId: "R10",
  roleName: "Team Lead",
  permissions: ["workflow:write", "employee:read:team"]
};

const requester = {
  id: "E-REQUESTER",
  organizationId: "ORG1",
  name: "Rahul Sharma",
  roleId: "R12",
  role: { name: "Software Engineer", level: "Individual Contributor" },
  designation: "Backend Developer",
  departmentId: "D001",
  department: { id: "D001", name: "Engineering" },
  teamId: "T001",
  team: { id: "T001", name: "Backend Team" },
  businessUnit: "Technology",
  managerId: "E-MANAGER",
  manager: {
    id: "E-MANAGER",
    organizationId: "ORG1",
    name: "Yash Malhotra",
    role: { name: "Team Lead", level: "Management" },
    designation: "Team Lead",
    departmentId: "D001",
    teamId: "T001",
    businessUnit: "Technology",
    managerId: "E-HEAD",
    employmentStatus: "Active",
    availabilityStatus: "Available"
  },
  projectMemberships: [{ allocationPct: 40 }],
  leaveBalances: [],
  employmentStatus: "Active",
  availabilityStatus: "Available"
};

const financeManager = {
  id: "E-FINANCE",
  organizationId: "ORG1",
  name: "Finance Manager",
  role: { name: "Manager", level: "Management" },
  designation: "Finance Manager",
  departmentId: "D003",
  teamId: "T005",
  businessUnit: "Corporate",
  managerId: "E-CFO",
  employmentStatus: "Active",
  availabilityStatus: "Available",
  approvals: []
};

describe("live workflow integration path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.employee.findUniqueOrThrow.mockResolvedValue(requester);
    prisma.employee.findMany.mockResolvedValue([financeManager]);
    prisma.leaveBalance.findMany.mockResolvedValue([]);
    prisma.projectMember.findMany.mockResolvedValue([]);
    prisma.request.count.mockResolvedValue(0);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (items: unknown[]) => Promise.all(items));
    prisma.approvalChainStep.createMany.mockResolvedValue({ count: 2 });
    prisma.routingDecisionLog.create.mockResolvedValue({});
  });

  it("creates a request through DB policy routing and persists chain plus decision log", async () => {
    prisma.$queryRaw.mockImplementation(queryRawForPolicy());
    prisma.request.create.mockImplementation(async (args) => ({ id: "REQ001", ...args.data }));

    const { createRequest } = await import("../src/workflows/workflow.service.js");
    const request = await createRequest(user, {
      type: "Expense Reimbursement",
      title: "Client travel reimbursement",
      amount: 85000,
      currency: "INR",
      category: "Travel",
      projectId: "P001",
      reason: "Customer visit",
      receipt: "attached"
    });

    expect(request.status).toBe("Pending Approval");
    expect(request.currentOwnerId).toBe("E-MANAGER");
    expect(prisma.request.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentOwnerId: "E-MANAGER",
        approvals: expect.objectContaining({
          create: [expect.objectContaining({ approverId: "E-MANAGER", status: "Pending" })]
        })
      })
    }));
    expect(prisma.approvalChainStep.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ approverId: "E-MANAGER", status: "PENDING" }),
        expect.objectContaining({ approverId: "E-FINANCE", status: "WAITING" })
      ])
    });
    expect(prisma.routingDecisionLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requestId: "REQ001",
        policyId: "POL-EXPENSE_REIMBURSEMENT",
        status: "PENDING_APPROVAL"
      })
    }));
  });

  it("advances the next sequential approval step after approval", async () => {
    prisma.approval.findUnique.mockResolvedValue({
      id: "APR1",
      requestId: "REQ001",
      approverId: "E-MANAGER",
      stage: "1-DIRECT_MANAGER",
      status: "Pending",
      request: { id: "REQ001", employeeId: "E-REQUESTER" }
    });
    prisma.approval.update.mockResolvedValue({ id: "APR1", status: "Approved" });
    prisma.$queryRaw.mockResolvedValue([{
      id: "REQ001-2-FINANCE",
      approverId: "E-FINANCE",
      requirementId: "2-FINANCE",
      reason: "Finance validation required"
    }]);
    prisma.request.update.mockResolvedValue({});
    prisma.approval.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const { decideApproval } = await import("../src/workflows/workflow.service.js");
    const updated = await decideApproval(managerUser, "APR1", "Approved", "Looks good");

    expect(updated).toEqual({ id: "APR1", status: "Approved" });
    expect(prisma.request.update).toHaveBeenCalledWith({
      where: { id: "REQ001" },
      data: { status: "Pending Approval", currentOwnerId: "E-FINANCE" }
    });
    expect(prisma.approval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: "REQ001",
        approverId: "E-FINANCE",
        stage: "2-FINANCE",
        status: "Pending"
      })
    });
  });
});

function queryRawForPolicy() {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join(" ");
    if (sql.includes("FROM routing_policy_configs")) {
      return [{ id: "POL-EXPENSE_REIMBURSEMENT", version: 3, name: "Expense policy" }];
    }
    if (sql.includes("FROM approval_requirement_configs")) {
      return [
        {
          id: "REQ-DM",
          requirementKey: "1-DIRECT_MANAGER",
          source: "DIRECT_MANAGER",
          label: "Manager Approval",
          sequence: 1,
          mode: "Sequential",
          conditionAmountGt: null,
          conditionDurationGt: null,
          minimumApprovalLimit: 50000,
          slaMinutes: 2880,
          policyReasonsJson: JSON.stringify(["Reimbursements require management approval"])
        },
        {
          id: "REQ-FIN",
          requirementKey: "2-FINANCE",
          source: "FINANCE",
          label: "Finance Approval",
          sequence: 2,
          mode: "Sequential",
          conditionAmountGt: 10000,
          conditionDurationGt: null,
          minimumApprovalLimit: null,
          slaMinutes: 2880,
          policyReasonsJson: JSON.stringify(["Reimbursement amount requires finance validation"])
        }
      ];
    }
    return [];
  });
}
