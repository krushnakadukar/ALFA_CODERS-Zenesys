import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { HttpError } from "../http/errors.js";
import { createOpaqueToken, hashToken, refreshExpiry, signAccessToken } from "./tokens.js";

async function loadAuthUser(userId: string) {
  const account = await prisma.userAccount.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        where: { active: true },
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } }
        }
      },
      employee: {
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } }
        }
      }
    }
  });

  if (!account || account.status !== "Active") {
    throw new HttpError(401, "Invalid credentials");
  }

  const assignedRoles = account.userRoles.map((assignment) => ({
    roleId: assignment.roleId,
    roleName: assignment.role.name,
    permissions: assignment.role.rolePermissions.map((item) => item.permission.id),
    scope: {
      organizationId: assignment.organizationId,
      businessUnit: assignment.businessUnit,
      departmentId: assignment.departmentId,
      teamId: assignment.teamId,
      resourceId: assignment.resourceId,
      workflowId: assignment.workflowId
    }
  }));
  const roles =
    assignedRoles.length > 0
      ? assignedRoles
      : [
          {
            roleId: account.employee.roleId,
            roleName: account.employee.role.name,
            permissions: account.employee.role.rolePermissions.map((item) => item.permission.id),
            scope: { organizationId: account.employee.organizationId }
          }
        ];
  const permissions = Array.from(new Set(roles.flatMap((role) => role.permissions))).sort();
  const primaryRole = roles[0];

  return {
    userId: account.id,
    employeeId: account.employee.id,
    organizationId: account.employee.organizationId,
    roleId: primaryRole.roleId,
    roleName: primaryRole.roleName,
    permissions,
    roles
  };
}

async function issueRefreshToken(userId: string) {
  const token = createOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      expiresAt: refreshExpiry()
    }
  });
  return token;
}

export async function login(email: string, password: string) {
  const account = await prisma.userAccount.findUnique({ where: { email } });
  if (!account || account.status !== "Active") {
    throw new HttpError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, account.passwordHash);
  if (!validPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  const user = await loadAuthUser(account.id);
  return {
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(account.id),
    user
  };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }
  });

  if (!stored) {
    throw new HttpError(401, "Invalid refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const user = await loadAuthUser(stored.userId);
  return {
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(stored.userId),
    user
  };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
