import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "./auth.middleware.js";
import * as authService from "./auth.service.js";
import { ensureEmployeeLeaveBalances } from "../workflows/workflow.service.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    res.json(await authService.login(body.email, body.password));
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    res.json(await authService.refresh(body.refreshToken));
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    await authService.logout(body.refreshToken);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    await ensureEmployeeLeaveBalances(req.user!.employeeId);
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: req.user!.employeeId },
      include: { role: true, department: true, team: true, manager: true, leaveBalances: true }
    });
    res.json({ user: req.user, employee });
  } catch (error) {
    next(error);
  }
});

export const authRouter = router;
