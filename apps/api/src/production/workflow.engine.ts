import type { WorkflowInput, WorkflowPlan } from "./domain.js";

export interface WorkflowRepository {
  loadActiveWorkflow(input: WorkflowInput): Promise<{
    workflowId: string;
    steps: Array<{
      workflowStepId: string;
      name: string;
      mode: "Sequential" | "Parallel";
      approverRule: Record<string, unknown>;
      slaPolicyId?: string;
    }>;
  }>;
  resolveApprovers(rule: Record<string, unknown>, input: WorkflowInput): Promise<string[]>;
  buildContext(input: WorkflowInput): Promise<WorkflowPlan["context"]>;
  evaluatePolicies(input: WorkflowInput): Promise<WorkflowPlan["policyViolations"]>;
}

export class WorkflowEngine {
  constructor(private readonly repository: WorkflowRepository) {}

  async plan(input: WorkflowInput): Promise<WorkflowPlan> {
    const [workflow, context, policyViolations] = await Promise.all([
      this.repository.loadActiveWorkflow(input),
      this.repository.buildContext(input),
      this.repository.evaluatePolicies(input)
    ]);

    const steps = [];
    for (const step of workflow.steps) {
      const approverEmployeeIds = await this.repository.resolveApprovers(step.approverRule, input);
      steps.push({
        workflowStepId: step.workflowStepId,
        name: step.name,
        mode: step.mode,
        approverEmployeeIds,
        slaPolicyId: step.slaPolicyId
      });
    }

    return {
      workflowId: workflow.workflowId,
      steps,
      context,
      policyViolations,
      notifications: steps.flatMap((step) =>
        step.approverEmployeeIds.map((recipientEmployeeId) => ({
          recipientEmployeeId,
          type: "ApprovalAssigned",
          message: `${step.name} approval is waiting`
        }))
      )
    };
  }
}
