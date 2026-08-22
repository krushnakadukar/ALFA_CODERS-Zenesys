export type AuthUser = {
  userId: string;
  employeeId: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  roles: Array<{
    roleId: string;
    roleName: string;
    permissions: string[];
    scope: {
      organizationId: string;
      businessUnit?: string | null;
      departmentId?: string | null;
      teamId?: string | null;
      resourceId?: string | null;
      workflowId?: string | null;
    };
  }>;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
