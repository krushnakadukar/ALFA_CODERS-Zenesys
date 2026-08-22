import { prisma } from "../db.js";
import type { AuthUser } from "../types.js";

export async function canReadEmployee(user: AuthUser, employeeId: string) {
  if (user.permissions.includes("employee:read:any")) return true;
  if (user.employeeId === employeeId && user.permissions.includes("employee:read:self")) return true;
  if (!user.permissions.includes("employee:read:team")) return false;

  const chain = await getManagerChain(employeeId);
  return chain.some((manager) => manager.id === user.employeeId);
}

export async function getManagerChain(employeeId: string) {
  const chain = [];
  let current = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { manager: { include: { role: true, department: true, team: true } } }
  });

  const seen = new Set<string>();
  while (current?.manager && !seen.has(current.manager.id)) {
    seen.add(current.manager.id);
    chain.push(current.manager);
    current = await prisma.employee.findUnique({
      where: { id: current.manager.id },
      include: { manager: { include: { role: true, department: true, team: true } } }
    });
  }

  return chain;
}

export async function getOrgTree(organizationId: string) {
  const [organization, departments, teams, employees] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.department.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { organizationId },
      include: { role: true },
      orderBy: [{ managerId: "asc" }, { name: "asc" }]
    })
  ]);

  const employeesByTeam = new Map<string, typeof employees>();
  const employeesWithoutTeamByDepartment = new Map<string, typeof employees>();
  const executiveEmployees = [];

  for (const employee of employees) {
    if (employee.teamId) {
      const group = employeesByTeam.get(employee.teamId) ?? [];
      group.push(employee);
      employeesByTeam.set(employee.teamId, group);
    } else if (employee.departmentId) {
      const group = employeesWithoutTeamByDepartment.get(employee.departmentId) ?? [];
      group.push(employee);
      employeesWithoutTeamByDepartment.set(employee.departmentId, group);
    } else {
      executiveEmployees.push(employee);
    }
  }

  return {
    organization,
    executives: executiveEmployees,
    departments: departments.map((department: (typeof departments)[number]) => ({
      ...department,
      leaders: employeesWithoutTeamByDepartment.get(department.id) ?? [],
      teams: teams
        .filter((team: (typeof teams)[number]) => team.departmentId === department.id)
        .map((team: (typeof teams)[number]) => ({ ...team, employees: employeesByTeam.get(team.id) ?? [] }))
    }))
  };
}

export async function getDirectReports(employeeId: string) {
  return prisma.employee.findMany({
    where: { managerId: employeeId },
    include: { role: true, department: true, team: true },
    orderBy: { name: "asc" }
  });
}
