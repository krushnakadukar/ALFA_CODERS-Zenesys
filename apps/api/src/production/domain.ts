export type Scope = {
  organizationId: string;
  businessUnitId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  resourceId?: string | null;
  workflowId?: string | null;
};

export type PrincipalRole = {
  roleId: string;
  roleName: string;
  permissions: string[];
  scope: Scope;
};

export type Principal = {
  userId: string;
  employeeId?: string | null;
  organizationId: string;
  roles: PrincipalRole[];
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason: string;
};

export type WorkflowInput = {
  requestId: string;
  organizationId: string;
  requestTypeId: string;
  requesterEmployeeId: string;
  formData: Record<string, unknown>;
};

export type ResolvedWorkflowStep = {
  workflowStepId: string;
  name: string;
  mode: "Sequential" | "Parallel";
  approverEmployeeIds: string[];
  slaPolicyId?: string;
};

export type WorkflowPlan = {
  workflowId: string;
  steps: ResolvedWorkflowStep[];
  notifications: Array<{ recipientEmployeeId: string; type: string; message: string }>;
  context: Array<{ key: string; value: unknown; sourceType: string }>;
  policyViolations: Array<{ code: string; message: string; severity: "Info" | "Warning" | "Blocker" }>;
};

export type SlaClockEvent = {
  requestId: string;
  workflowStepId?: string;
  stage: string;
  deadlineAt: Date;
  status: "Open" | "ReminderDue" | "Breached" | "Escalated" | "Closed";
};

export type NotificationEnvelope = {
  organizationId: string;
  recipientUserId: string;
  requestId?: string;
  channel: "InApp" | "Email";
  type: string;
  message: string;
  payload?: Record<string, unknown>;
};

export type StoredFile = {
  fileId: string;
  organizationId: string;
  storageProvider: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  checksum?: string;
};

export type AiRequest = {
  organizationId: string;
  employeeId?: string;
  capability: "IntentDetection" | "RequestClassification" | "MissingInfoDetection" | "PriorityRecommendation" | "WorkflowRecommendation" | "Summarization";
  prompt: string;
  context?: Record<string, unknown>;
};

export type AiResult = {
  provider: string;
  model: string;
  output: Record<string, unknown>;
  confidence?: number;
};
