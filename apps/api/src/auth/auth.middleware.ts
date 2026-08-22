import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../http/errors.js";
import { verifyAccessToken } from "./tokens.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return next(new HttpError(401, "Missing bearer token"));

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(new HttpError(401, "Invalid bearer token"));
  }
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!req.user.permissions.includes(permission)) {
      return next(new HttpError(403, `Missing permission: ${permission}`));
    }
    return next();
  };
}
