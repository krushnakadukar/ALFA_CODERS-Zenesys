import { describe, expect, it } from "vitest";
import { WorkflowEngine, type WorkflowRepository } from "../src/production/workflow.engine.js";

describe("production workflow engine", () => {
  it("plans configurable sequential and parallel workflow steps", async () => {
    const repository: WorkflowRepository = {
      async loadActiveWorkflow() {
        return {
          workflowId: "WF1",
          steps: [
            { workflowStepId: "WS1", name: "Manager Review", mode: "Sequential", approverRule: { relationship: "ReportsTo" }, slaPolicyId: "SLA1" },
            { workflowStepId: "WS2", name: "Finance + HR", mode: "Parallel", approverRule: { roles: ["Finance", "HR"] }, slaPolicyId: "SLA2" }
          ]
        };
      },
      async resolveApprovers(rule) {
        return "relationship" in rule ? ["E-MANAGER"] : ["E-FINANCE", "E-HR"];
      },
      async buildContext() {
        return [{ key: "workload", value: { allocationPct: 80 }, sourceType: "ERP" }];
      },
      async evaluatePolicies() {
        return [];
      }
    };

    const plan = await new WorkflowEngine(repository).plan({
      requestId: "REQ1",
      organizationId: "ORG1",
      requestTypeId: "RT1",
      requesterEmployeeId: "E1",
      formData: {}
    });

    expect(plan.workflowId).toBe("WF1");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1].mode).toBe("Parallel");
    expect(plan.steps[1].approverEmployeeIds).toEqual(["E-FINANCE", "E-HR"]);
    expect(plan.notifications).toHaveLength(3);
  });
});
