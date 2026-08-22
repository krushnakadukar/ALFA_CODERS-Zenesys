import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/auth/tokens.js";
import type { AuthUser } from "../src/types.js";

describe("auth token roles", () => {
  it("preserves scoped role assignments in access tokens", () => {
    const user: AuthUser = {
      userId: "U1",
      employeeId: "E1",
      organizationId: "ORG1",
      roleId: "R1",
      roleName: "Manager",
      permissions: ["employee:read:self", "workflow:write"],
      roles: [
        {
          roleId: "R1",
          roleName: "Manager",
          permissions: ["employee:read:self"],
          scope: { organizationId: "ORG1", departmentId: "D1", teamId: "T1" }
        },
        {
          roleId: "R2",
          roleName: "Workflow Approver",
          permissions: ["workflow:write"],
          scope: { organizationId: "ORG1", workflowId: "WF1" }
        }
      ]
    };

    const verified = verifyAccessToken(signAccessToken(user));

    expect(verified.roles).toEqual(user.roles);
    expect(verified.permissions).toEqual(["employee:read:self", "workflow:write"]);
  });
});
