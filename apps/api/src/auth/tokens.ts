import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthUser } from "../types.js";

type AccessPayload = {
  sub: string;
  employeeId: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  roles?: AuthUser["roles"];
};

export function signAccessToken(user: AuthUser) {
  const payload: AccessPayload = {
    sub: user.userId,
    employeeId: user.employeeId,
    organizationId: user.organizationId,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: user.permissions,
    roles: user.roles
  };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessPayload;
  return {
    userId: payload.sub,
    employeeId: payload.employeeId,
    organizationId: payload.organizationId,
    roleId: payload.roleId,
    roleName: payload.roleName,
    permissions: payload.permissions ?? [],
    roles:
      payload.roles ??
      [{
        roleId: payload.roleId,
        roleName: payload.roleName,
        permissions: payload.permissions ?? [],
        scope: { organizationId: payload.organizationId }
      }]
  };
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}
