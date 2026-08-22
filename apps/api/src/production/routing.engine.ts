export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATING"
  | "ROUTING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SENT_BACK"
  | "ESCALATED"
  | "DELEGATED"
  | "ROUTING_EXCEPTION"
  | "CANCELLED"
  | "COMPLETED";

export type ApproverSource =
  | "DIRECT_MANAGER"
  | "FUNCTIONAL_MANAGER"
  | "MATRIX_MANAGER"
  | "DEPARTMENT_HEAD"
  | "DIVISION_HEAD"
  | "BUSINESS_UNIT_HEAD"
  | "HR"
  | "FINANCE"
  | "IT"
  | "PROCUREMENT"
  | "PROJECT_MANAGER"
  | "DELEGATED_APPROVER"
  | "POSITION_OWNER";

export type AvailabilityState =
  | "AVAILABLE"
  | "ON_LEAVE"
  | "OUT_OF_OFFICE"
  | "DELEGATED"
  | "INACTIVE"
  | "SUSPENDED"
  | "UNKNOWN";

export type RoutingRequest = {
  requestId: string;
  organizationId: string;
  requesterEmployeeId: string;
  requestType: string;
  subType?: string;
  amount?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  attributes: Record<string, unknown>;
};

export type RoutingEmployee = {
  employeeId: string;
  organizationId: string;
  name: string;
  role?: string | null;
  designation?: string | null;
  post?: string | null;
  grade?: string | null;
  departmentId?: string | null;
  divisionId?: string | null;
  businessUnitId?: string | null;
  teamId?: string | null;
  managerEmployeeId?: string | null;
  functionalManagerId?: string | null;
  matrixManagerId?: string | null;
  employmentStatus: string;
  availabilityState: AvailabilityState;
  approvalLimit?: number | null;
  currency?: string | null;
  pendingApprovals?: number;
};

export type RoutingContext = {
  request: RoutingRequest;
  requester: RoutingEmployee;
  submittedSnapshot: Record<string, unknown>;
  facts: Record<string, unknown>;
};

export type ApprovalRequirement = {
  requirementId: string;
  source: ApproverSource;
  label: string;
  sequence: number;
  mode: "Sequential" | "Parallel";
  requiredPermission?: string;
  minimumApprovalLimit?: number;
  slaMinutes?: number;
  policyReasons: string[];
};

export type RoutingPolicy = {
  policyId: string;
  version: number;
  requestType: string;
  requirements: ApprovalRequirement[];
};

export type ApproverCandidate = {
  employee: RoutingEmployee;
  source: ApproverSource;
  reason: string;
};

export type Delegation = {
  delegatorEmployeeId: string;
  delegate: RoutingEmployee;
  reason: string;
};

export type RejectedCandidate = {
  employeeId?: string;
  source: ApproverSource;
  reasonCode:
    | "NO_CANDIDATE"
    | "SELF_APPROVAL"
    | "INACTIVE_EMPLOYEE"
    | "UNAVAILABLE"
    | "CONFLICT_OF_INTEREST"
    | "LIMIT_EXCEEDED"
    | "UNAUTHORIZED";
  reason: string;
};

export type ApprovalChainStep = {
  stepId: string;
  requirementId: string;
  approverEmployeeId: string;
  approverName: string;
  approverRole?: string | null;
  source: ApproverSource;
  mode: "Sequential" | "Parallel";
  status: "PENDING";
  slaMinutes?: number;
  explanation: string[];
};

export type RoutingDecisionLog = {
  requestId: string;
  routingTimestamp: Date;
  routingEngineVersion: string;
  policyVersion: number;
  requesterContext: Record<string, unknown>;
  candidateApprovers: Array<{ employeeId: string; source: ApproverSource; reason: string }>;
  rejectedCandidates: RejectedCandidate[];
  selectedApprovers: Array<{ employeeId: string; requirementId: string; selectionReason: string }>;
  rulesEvaluated: string[];
};

export type RoutingPlan =
  | {
      status: "PENDING_APPROVAL";
      policyId: string;
      policyVersion: number;
      approvalChain: ApprovalChainStep[];
      decisionLog: RoutingDecisionLog;
    }
  | {
      status: "ROUTING_EXCEPTION";
      policyId?: string;
      policyVersion?: number;
      reasonCode: "NO_POLICY_FOUND" | "NO_VALID_APPROVER_FOUND";
      reason: string;
      decisionLog: RoutingDecisionLog;
    };

export interface RoutingRepository {
  buildContext(request: RoutingRequest): Promise<RoutingContext>;
  loadPolicy(context: RoutingContext): Promise<RoutingPolicy | null>;
  discoverApprovers(requirement: ApprovalRequirement, context: RoutingContext): Promise<ApproverCandidate[]>;
  findValidDelegation(candidate: ApproverCandidate, requirement: ApprovalRequirement, context: RoutingContext): Promise<Delegation | null>;
  findNextAuthorizedSuperior(candidate: ApproverCandidate, requirement: ApprovalRequirement, context: RoutingContext): Promise<ApproverCandidate | null>;
  findPolicyAlternate(requirement: ApprovalRequirement, context: RoutingContext): Promise<ApproverCandidate | null>;
  evaluateConflicts(candidate: ApproverCandidate, requirement: ApprovalRequirement, context: RoutingContext): Promise<string[]>;
  hasApprovalAuthority(candidate: ApproverCandidate, requirement: ApprovalRequirement, context: RoutingContext): Promise<boolean>;
}

export class IntelligentRoutingEngine {
  static readonly version = "routing-engine-v1";

  constructor(private readonly repository: RoutingRepository) {}

  async route(request: RoutingRequest): Promise<RoutingPlan> {
    const context = await this.repository.buildContext(request);
    const policy = await this.repository.loadPolicy(context);
    const decisionLog = createDecisionLog(request.requestId, policy?.version ?? 0, context);

    if (!policy) {
      return {
        status: "ROUTING_EXCEPTION",
        reasonCode: "NO_POLICY_FOUND",
        reason: `No active routing policy found for ${request.requestType}`,
        decisionLog
      };
    }

    decisionLog.rulesEvaluated.push(`Loaded policy ${policy.policyId} v${policy.version}`);
    const approvalChain: ApprovalChainStep[] = [];

    for (const requirement of [...policy.requirements].sort((a, b) => a.sequence - b.sequence)) {
      decisionLog.rulesEvaluated.push(...requirement.policyReasons);
      const selected = await this.resolveRequirement(requirement, context, decisionLog);
      if (!selected) {
        return {
          status: "ROUTING_EXCEPTION",
          policyId: policy.policyId,
          policyVersion: policy.version,
          reasonCode: "NO_VALID_APPROVER_FOUND",
          reason: `No valid approver found for ${requirement.label}`,
          decisionLog
        };
      }

      approvalChain.push({
        stepId: `${request.requestId}-${requirement.requirementId}`,
        requirementId: requirement.requirementId,
        approverEmployeeId: selected.employee.employeeId,
        approverName: selected.employee.name,
        approverRole: selected.employee.role,
        source: selected.source,
        mode: requirement.mode,
        status: "PENDING",
        slaMinutes: requirement.slaMinutes,
        explanation: [
          `Request type = ${request.requestType}`,
          ...requirement.policyReasons,
          selected.reason,
          `${selected.employee.name} is authorized and valid for ${requirement.label}`,
          "No self-approval or conflict-of-interest violation detected"
        ]
      });
      decisionLog.selectedApprovers.push({
        employeeId: selected.employee.employeeId,
        requirementId: requirement.requirementId,
        selectionReason: selected.reason
      });
    }

    return {
      status: "PENDING_APPROVAL",
      policyId: policy.policyId,
      policyVersion: policy.version,
      approvalChain,
      decisionLog
    };
  }

  private async resolveRequirement(
    requirement: ApprovalRequirement,
    context: RoutingContext,
    decisionLog: RoutingDecisionLog
  ) {
    const queue = await this.repository.discoverApprovers(requirement, context);
    const alternate = await this.repository.findPolicyAlternate(requirement, context);
    if (alternate) queue.push(alternate);

    if (queue.length === 0) {
      decisionLog.rejectedCandidates.push({
        source: requirement.source,
        reasonCode: "NO_CANDIDATE",
        reason: `No candidate returned for ${requirement.source}`
      });
    }

    const seen = new Set<string>();
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      const employeeId = candidate.employee.employeeId;
      const seenKey = `${requirement.requirementId}:${employeeId}:${candidate.source}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      decisionLog.candidateApprovers.push({ employeeId, source: candidate.source, reason: candidate.reason });
      const rejection = await this.validateCandidate(candidate, requirement, context);
      if (!rejection) return candidate;

      decisionLog.rejectedCandidates.push(rejection);

      const delegation = await this.delegationFor(candidate, requirement, context, rejection);
      if (delegation) {
        queue.unshift({
          employee: delegation.delegate,
          source: "DELEGATED_APPROVER",
          reason: `Explicit delegation from ${candidate.employee.name}: ${delegation.reason}`
        });
        continue;
      }

      const superior = await this.repository.findNextAuthorizedSuperior(candidate, requirement, context);
      if (superior) queue.unshift(superior);
    }

    return null;
  }

  private async validateCandidate(
    candidate: ApproverCandidate,
    requirement: ApprovalRequirement,
    context: RoutingContext
  ): Promise<RejectedCandidate | null> {
    const employee = candidate.employee;
    if (employee.employeeId === context.requester.employeeId) {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "SELF_APPROVAL",
        reason: "Requester cannot approve their own request"
      };
    }
    if (employee.organizationId !== context.request.organizationId) {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "UNAUTHORIZED",
        reason: "Approver is outside the request organization"
      };
    }
    if (employee.employmentStatus !== "Active" || employee.availabilityState === "INACTIVE" || employee.availabilityState === "SUSPENDED") {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "INACTIVE_EMPLOYEE",
        reason: `Approver employment/availability state is ${employee.employmentStatus}/${employee.availabilityState}`
      };
    }
    if (employee.availabilityState !== "AVAILABLE") {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "UNAVAILABLE",
        reason: `Approver availability state is ${employee.availabilityState}`
      };
    }
    if (!(await this.repository.hasApprovalAuthority(candidate, requirement, context))) {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "UNAUTHORIZED",
        reason: `Approver lacks authority for ${requirement.label}`
      };
    }
    if (requirement.minimumApprovalLimit && context.request.amount && (employee.approvalLimit ?? 0) < context.request.amount) {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "LIMIT_EXCEEDED",
        reason: `Request amount ${context.request.amount} exceeds approval limit ${employee.approvalLimit ?? 0}`
      };
    }

    const conflicts = await this.repository.evaluateConflicts(candidate, requirement, context);
    if (conflicts.length > 0) {
      return {
        employeeId: employee.employeeId,
        source: candidate.source,
        reasonCode: "CONFLICT_OF_INTEREST",
        reason: conflicts.join("; ")
      };
    }

    return null;
  }

  private async delegationFor(
    candidate: ApproverCandidate,
    requirement: ApprovalRequirement,
    context: RoutingContext,
    rejection: RejectedCandidate
  ) {
    if (!["UNAVAILABLE", "INACTIVE_EMPLOYEE"].includes(rejection.reasonCode)) return null;
    return this.repository.findValidDelegation(candidate, requirement, context);
  }
}

function createDecisionLog(requestId: string, policyVersion: number, context: RoutingContext): RoutingDecisionLog {
  return {
    requestId,
    routingTimestamp: new Date(),
    routingEngineVersion: IntelligentRoutingEngine.version,
    policyVersion,
    requesterContext: context.submittedSnapshot,
    candidateApprovers: [],
    rejectedCandidates: [],
    selectedApprovers: [],
    rulesEvaluated: []
  };
}
