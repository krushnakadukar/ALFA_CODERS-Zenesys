import { describe, expect, it } from "vitest";
import { canApprove, hasPermission } from "../src/production/authorization.policy.js";
import type { Principal } from "../src/production/domain.js";

const principal: Principal = {
  userId: "U1",
  employeeId: "E1",
  organizationId: "ORG1",
  roles: [
    {
      roleId: "R1",
      roleName: "Department Approver",
      permissions: ["request.read", "workflow.approve"],
      scope: { organizationId: "ORG1", departmentId: "D1" }
    }
  ]
};

describe("production authorization policy", () => {
  it("allows scoped permissions inside the same organization and department", () => {
    const decision = hasPermission(principal, "request.read", { organizationId: "ORG1", departmentId: "D1" });
    expect(decision.allowed).toBe(true);
  });

  it("denies cross-organization access", () => {
    const decision = hasPermission(principal, "request.read", { organizationId: "ORG2", departmentId: "D1" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Cross-organization");
  });

  it("denies department scope escalation", () => {
    const decision = hasPermission(principal, "request.read", { organizationId: "ORG1", departmentId: "D2" });
    expect(decision.allowed).toBe(false);
  });

  it("allows only assigned approvers unless elevated permission exists", () => {
    expect(canApprove(principal, ["E1"], { organizationId: "ORG1", departmentId: "D1" }).allowed).toBe(true);
    expect(canApprove(principal, ["E2"], { organizationId: "ORG1", departmentId: "D1" }).allowed).toBe(false);
  });
});
