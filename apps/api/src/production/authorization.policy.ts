import type { AuthorizationDecision, Principal, Scope } from "./domain.js";

export function hasPermission(principal: Principal, permission: string, targetScope: Scope): AuthorizationDecision {
  if (principal.organizationId !== targetScope.organizationId) {
    return { allowed: false, reason: "Cross-organization access denied" };
  }

  const matchingRole = principal.roles.find((role) => {
    if (!role.permissions.includes(permission)) return false;
    if (!scopeContains(role.scope, targetScope)) return false;
    return true;
  });

  return matchingRole
    ? { allowed: true, reason: `Allowed by role ${matchingRole.roleName}` }
    : { allowed: false, reason: `Missing scoped permission ${permission}` };
}

export function canApprove(principal: Principal, approverEmployeeIds: string[], targetScope: Scope): AuthorizationDecision {
  if (principal.organizationId !== targetScope.organizationId) {
    return { allowed: false, reason: "Cross-organization approval denied" };
  }
  if (principal.employeeId && approverEmployeeIds.includes(principal.employeeId)) {
    return { allowed: true, reason: "Assigned approver" };
  }
  return hasPermission(principal, "workflow.approve.any", targetScope);
}

function scopeContains(roleScope: Scope, targetScope: Scope) {
  if (roleScope.organizationId !== targetScope.organizationId) return false;
  if (roleScope.businessUnitId && roleScope.businessUnitId !== targetScope.businessUnitId) return false;
  if (roleScope.divisionId && roleScope.divisionId !== targetScope.divisionId) return false;
  if (roleScope.departmentId && roleScope.departmentId !== targetScope.departmentId) return false;
  if (roleScope.teamId && roleScope.teamId !== targetScope.teamId) return false;
  if (roleScope.resourceId && roleScope.resourceId !== targetScope.resourceId) return false;
  if (roleScope.workflowId && roleScope.workflowId !== targetScope.workflowId) return false;
  return true;
}
