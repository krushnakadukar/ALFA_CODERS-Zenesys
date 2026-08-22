import { describe, expect, it } from "vitest";
import {
  IntelligentRoutingEngine,
  type ApprovalRequirement,
  type ApproverCandidate,
  type RoutingContext,
  type RoutingEmployee,
  type RoutingPolicy,
  type RoutingRepository,
  type RoutingRequest
} from "../src/production/routing.engine.js";

const requesterManager: RoutingEmployee = {
  employeeId: "E-MGR",
  organizationId: "ORG1",
  name: "Rahul Sharma",
  role: "Engineering Manager",
  designation: "Engineering Manager",
  departmentId: "D-ENG",
  managerEmployeeId: "E-CTO",
  employmentStatus: "Active",
  availabilityState: "AVAILABLE",
  approvalLimit: 50000,
  currency: "INR"
};

const cto: RoutingEmployee = {
  employeeId: "E-CTO",
  organizationId: "ORG1",
  name: "Neha Kulkarni",
  role: "CTO",
  designation: "Chief Technology Officer",
  departmentId: "D-ENG",
  employmentStatus: "Active",
  availabilityState: "AVAILABLE",
  approvalLimit: 500000,
  currency: "INR"
};

const financeRequester: RoutingEmployee = {
  employeeId: "E-FIN-1",
  organizationId: "ORG1",
  name: "Omkar Patil",
  role: "Finance Manager",
  departmentId: "D-FIN",
  employmentStatus: "Active",
  availabilityState: "AVAILABLE",
  approvalLimit: 150000,
  currency: "INR"
};

const alternateFinance: RoutingEmployee = {
  employeeId: "E-FIN-2",
  organizationId: "ORG1",
  name: "Vikram Shah",
  role: "Finance Head",
  departmentId: "D-FIN",
  employmentStatus: "Active",
  availabilityState: "AVAILABLE",
  approvalLimit: 500000,
  currency: "INR"
};

const unavailableManager: RoutingEmployee = {
  ...cto,
  employeeId: "E-HEAD",
  name: "Engineering Head",
  availabilityState: "ON_LEAVE"
};

const delegatedHead: RoutingEmployee = {
  ...cto,
  employeeId: "E-DELEGATE",
  name: "Delegated Engineering Head"
};

describe("intelligent routing engine", () => {
  it("rejects manager self-approval and moves to the next authorized superior", async () => {
    const requirement = requirementFor("DIRECT_MANAGER", "Manager Approval", ["Leave policy requires line-management approval"]);
    const engine = new IntelligentRoutingEngine(
      repository({
        requester: requesterManager,
        requirements: [requirement],
        candidates: { DIRECT_MANAGER: [candidate(requesterManager, "DIRECT_MANAGER", "Requester is the manager for this team")] },
        superiors: { "E-MGR": candidate(cto, "DIRECT_MANAGER", "Requester was excluded; next authorized superior is CTO") }
      })
    );

    const plan = await engine.route(requestFor("LEAVE_REQUEST", requesterManager.employeeId));

    expect(plan.status).toBe("PENDING_APPROVAL");
    if (plan.status !== "PENDING_APPROVAL") throw new Error("Expected pending approval");
    expect(plan.approvalChain[0].approverEmployeeId).toBe("E-CTO");
    expect(plan.decisionLog.rejectedCandidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ employeeId: "E-MGR", reasonCode: "SELF_APPROVAL" })])
    );
    expect(plan.approvalChain[0].explanation.join(" ")).toContain("Requester was excluded");
  });

  it("excludes requester from an indirect finance approval step", async () => {
    const requirement = requirementFor("FINANCE", "Finance Approval", [
      "Expense amount exceeds direct-manager authority",
      "Finance approval required by policy"
    ]);
    const engine = new IntelligentRoutingEngine(
      repository({
        requester: financeRequester,
        requirements: [requirement],
        candidates: {
          FINANCE: [
            candidate(financeRequester, "FINANCE", "Requester is a finance approver"),
            candidate(alternateFinance, "FINANCE", "Alternate finance authority covers this department")
          ]
        }
      })
    );

    const plan = await engine.route({ ...requestFor("EXPENSE_REIMBURSEMENT", financeRequester.employeeId), amount: 85000 });

    expect(plan.status).toBe("PENDING_APPROVAL");
    if (plan.status !== "PENDING_APPROVAL") throw new Error("Expected pending approval");
    expect(plan.approvalChain[0].approverEmployeeId).toBe("E-FIN-2");
    expect(plan.decisionLog.rejectedCandidates[0]).toMatchObject({ employeeId: "E-FIN-1", reasonCode: "SELF_APPROVAL" });
  });

  it("uses explicit valid delegation before hierarchy fallback when an approver is unavailable", async () => {
    const requirement = requirementFor("DEPARTMENT_HEAD", "Department Head Approval", ["Extended leave requires department approval"]);
    const engine = new IntelligentRoutingEngine(
      repository({
        requester: requesterManager,
        requirements: [requirement],
        candidates: { DEPARTMENT_HEAD: [candidate(unavailableManager, "DEPARTMENT_HEAD", "Department head owns this approval")] },
        delegations: {
          "E-HEAD": { delegatorEmployeeId: "E-HEAD", delegate: delegatedHead, reason: "Leave approvals delegated during scheduled absence" }
        }
      })
    );

    const plan = await engine.route(requestFor("LEAVE_REQUEST", requesterManager.employeeId));

    expect(plan.status).toBe("PENDING_APPROVAL");
    if (plan.status !== "PENDING_APPROVAL") throw new Error("Expected pending approval");
    expect(plan.approvalChain[0].approverEmployeeId).toBe("E-DELEGATE");
    expect(plan.approvalChain[0].source).toBe("DELEGATED_APPROVER");
  });

  it("creates a routing exception instead of auto-approving when no valid approver exists", async () => {
    const requirement = requirementFor("DIRECT_MANAGER", "Manager Approval", ["Attendance corrections require manager approval"]);
    const engine = new IntelligentRoutingEngine(
      repository({
        requester: requesterManager,
        requirements: [requirement],
        candidates: { DIRECT_MANAGER: [candidate(requesterManager, "DIRECT_MANAGER", "Only discovered manager candidate")] }
      })
    );

    const plan = await engine.route(requestFor("ATTENDANCE_CORRECTION", requesterManager.employeeId));

    expect(plan.status).toBe("ROUTING_EXCEPTION");
    if (plan.status !== "ROUTING_EXCEPTION") throw new Error("Expected routing exception");
    expect(plan.reasonCode).toBe("NO_VALID_APPROVER_FOUND");
    expect(plan.decisionLog.selectedApprovers).toHaveLength(0);
  });
});

function repository(options: {
  requester: RoutingEmployee;
  requirements: ApprovalRequirement[];
  candidates: Partial<Record<ApprovalRequirement["source"], ApproverCandidate[]>>;
  superiors?: Record<string, ApproverCandidate>;
  delegations?: Record<string, Awaited<ReturnType<RoutingRepository["findValidDelegation"]>>>;
}): RoutingRepository {
  return {
    async buildContext(request) {
      return contextFor(request, options.requester);
    },
    async loadPolicy(context) {
      return policyFor(context.request.requestType, options.requirements);
    },
    async discoverApprovers(requirement) {
      return options.candidates[requirement.source] ?? [];
    },
    async findValidDelegation(candidate) {
      return options.delegations?.[candidate.employee.employeeId] ?? null;
    },
    async findNextAuthorizedSuperior(candidate) {
      return options.superiors?.[candidate.employee.employeeId] ?? null;
    },
    async findPolicyAlternate() {
      return null;
    },
    async evaluateConflicts() {
      return [];
    },
    async hasApprovalAuthority(candidate, requirement, context) {
      if (requirement.minimumApprovalLimit && context.request.amount) {
        return (candidate.employee.approvalLimit ?? 0) >= context.request.amount;
      }
      return true;
    }
  };
}

function requirementFor(source: ApprovalRequirement["source"], label: string, policyReasons: string[]): ApprovalRequirement {
  return {
    requirementId: source,
    source,
    label,
    sequence: 1,
    mode: "Sequential",
    minimumApprovalLimit: source === "FINANCE" ? 1 : undefined,
    policyReasons
  };
}

function requestFor(requestType: string, requesterEmployeeId: string): RoutingRequest {
  return {
    requestId: "REQ-1",
    organizationId: "ORG1",
    requesterEmployeeId,
    requestType,
    currency: "INR",
    attributes: {}
  };
}

function contextFor(request: RoutingRequest, requester: RoutingEmployee): RoutingContext {
  return {
    request,
    requester,
    submittedSnapshot: {
      requesterEmployeeId: requester.employeeId,
      role: requester.role,
      designation: requester.designation,
      departmentId: requester.departmentId,
      managerEmployeeId: requester.managerEmployeeId
    },
    facts: {}
  };
}

function policyFor(requestType: string, requirements: ApprovalRequirement[]): RoutingPolicy {
  return {
    policyId: `POL-${requestType}`,
    version: 1,
    requestType,
    requirements
  };
}

function candidate(employee: RoutingEmployee, source: ApprovalRequirement["source"], reason: string): ApproverCandidate {
  return { employee, source, reason };
}
