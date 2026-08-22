import { Router } from "express";
import { prisma } from "../db.js";
import { HttpError } from "../http/errors.js";
import { requireAuth, requirePermission } from "../auth/auth.middleware.js";
import { canReadEmployee, getDirectReports, getManagerChain, getOrgTree } from "./org.service.js";

const router = Router();

router.use(requireAuth);

router.get("/tree", requirePermission("org:read"), async (req, res, next) => {
  try {
    res.json(await getOrgTree(req.user!.organizationId));
  } catch (error) {
    next(error);
  }
});

router.get("/departments", requirePermission("org:read"), async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { teams: true },
      orderBy: { name: "asc" }
    });
    res.json({ departments });
  } catch (error) {
    next(error);
  }
});

router.get("/teams", requirePermission("org:read"), async (_req, res, next) => {
  try {
    const teams = await prisma.team.findMany({ include: { department: true }, orderBy: { name: "asc" } });
    res.json({ teams });
  } catch (error) {
    next(error);
  }
});

router.get("/roles", requirePermission("org:read"), async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { id: "asc" }
    });
    res.json({ roles });
  } catch (error) {
    next(error);
  }
});

router.get("/employees", requirePermission("org:read"), async (req, res, next) => {
  try {
    const canReadAny = req.user!.permissions.includes("employee:read:any");
    const canReadTeam = req.user!.permissions.includes("employee:read:team");
    const reports = canReadTeam ? await getDirectReports(req.user!.employeeId) : [];
    const employeeIds = new Set([req.user!.employeeId, ...reports.map((employee: { id: string }) => employee.id)]);

    const employees = await prisma.employee.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(canReadAny ? {} : { id: { in: [...employeeIds] } })
      },
      include: { role: true, department: true, team: true, manager: true },
      orderBy: { name: "asc" }
    });

    res.json({ employees });
  } catch (error) {
    next(error);
  }
});

router.get("/employees/:id", async (req, res, next) => {
  try {
    if (!(await canReadEmployee(req.user!, req.params.id))) {
      throw new HttpError(403, "You cannot view this employee");
    }

    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { role: true, department: true, team: true, manager: true, directReports: true }
    });
    res.json({ employee });
  } catch (error) {
    next(error);
  }
});

router.get("/employees/:id/reports", async (req, res, next) => {
  try {
    if (!(await canReadEmployee(req.user!, req.params.id))) {
      throw new HttpError(403, "You cannot view this reporting graph");
    }
    res.json({ reports: await getDirectReports(req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.get("/employees/:id/manager-chain", async (req, res, next) => {
  try {
    if (!(await canReadEmployee(req.user!, req.params.id))) {
      throw new HttpError(403, "You cannot view this manager chain");
    }
    res.json({ managerChain: await getManagerChain(req.params.id) });
  } catch (error) {
    next(error);
  }
});

export const orgRouter = router;
