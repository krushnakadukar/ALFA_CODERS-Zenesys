import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  ["R001", "CEO", "Executive"],
  ["R002", "CTO", "Executive"],
  ["R003", "CFO", "Executive"],
  ["R004", "CHRO", "Executive"],
  ["R005", "COO", "Executive"],
  ["R006", "CMO", "Executive"],
  ["R007", "Department Head", "Management"],
  ["R008", "Senior Manager", "Management"],
  ["R009", "Manager", "Management"],
  ["R010", "Team Lead", "Management"],
  ["R011", "Senior Engineer", "Individual Contributor"],
  ["R012", "Software Engineer", "Individual Contributor"],
  ["R013", "HR Executive", "Individual Contributor"],
  ["R014", "Finance Analyst", "Individual Contributor"],
  ["R015", "Sales Executive", "Individual Contributor"],
  ["R016", "QA Engineer", "Individual Contributor"],
  ["R017", "DevOps Engineer", "Individual Contributor"],
  ["R018", "Security Analyst", "Individual Contributor"],
  ["R019", "Marketing Executive", "Individual Contributor"],
  ["R020", "Admin Executive", "Individual Contributor"]
] as const;

const departments = [
  ["D001", "Engineering", "Technology", "CTO"],
  ["D002", "Human Resources", "Corporate", "CHRO"],
  ["D003", "Finance", "Corporate", "CFO"],
  ["D004", "Operations", "Business", "COO"],
  ["D005", "Marketing", "Business", "CMO"],
  ["D006", "Sales", "Business", "CCO"],
  ["D007", "Information Security", "Technology", "CTO"],
  ["D008", "Administration", "Corporate", "COO"]
] as const;

const teams = [
  ["T001", "Backend Team", "D001"],
  ["T002", "Frontend Team", "D001"],
  ["T003", "QA Team", "D001"],
  ["T004", "HR Operations", "D002"],
  ["T005", "Finance Operations", "D003"],
  ["T006", "Business Operations", "D004"],
  ["T007", "Digital Marketing", "D005"],
  ["T008", "Enterprise Sales", "D006"],
  ["T009", "Security Operations", "D007"],
  ["T010", "Facilities", "D008"],
  ["T011", "DevOps Team", "D001"],
  ["T012", "Data Team", "D001"]
] as const;

const employees = [
  ["E001", "Aarav Mehta", "R001", null, null, "Corporate", "CEO", "aarav.mehta@example.com", "2020-01-01", null],
  ["E002", "Neha Kulkarni", "R002", "D001", null, "Technology", "CTO", "neha.kulkarni@example.com", "2020-02-15", "E001"],
  ["E003", "Vikram Shah", "R003", "D003", null, "Corporate", "CFO", "vikram.shah@example.com", "2020-03-01", "E001"],
  ["E004", "Priya Nair", "R004", "D002", null, "Corporate", "CHRO", "priya.nair@example.com", "2020-04-10", "E001"],
  ["E005", "Rohan Desai", "R005", "D004", null, "Business", "COO", "rohan.desai@example.com", "2020-05-12", "E001"],
  ["E006", "Sneha Patil", "R006", "D005", null, "Business", "CMO", "sneha.patil@example.com", "2020-06-01", "E001"],
  ["E007", "Arjun Rao", "R007", "D001", null, "Technology", "Engineering Head", "arjun.rao@example.com", "2021-01-10", "E002"],
  ["E008", "Meera Joshi", "R007", "D002", null, "Corporate", "HR Head", "meera.joshi@example.com", "2021-02-12", "E004"],
  ["E009", "Kunal Bhat", "R007", "D003", null, "Corporate", "Finance Head", "kunal.bhat@example.com", "2021-03-15", "E003"],
  ["E010", "Ishita Roy", "R007", "D004", null, "Business", "Operations Head", "ishita.roy@example.com", "2021-04-20", "E005"],
  ["E011", "Aditya Menon", "R008", "D001", "T001", "Technology", "Senior Manager", "aditya.menon@example.com", "2021-05-01", "E007"],
  ["E012", "Kavya Iyer", "R008", "D001", "T002", "Technology", "Senior Manager", "kavya.iyer@example.com", "2021-05-10", "E007"],
  ["E013", "Nikhil Verma", "R008", "D001", "T003", "Technology", "Senior Manager", "nikhil.verma@example.com", "2021-06-01", "E007"],
  ["E014", "Simran Kaur", "R009", "D002", "T004", "Corporate", "HR Manager", "simran.kaur@example.com", "2021-06-15", "E008"],
  ["E015", "Rahul Gupta", "R009", "D003", "T005", "Corporate", "Finance Manager", "rahul.gupta@example.com", "2021-07-01", "E009"],
  ["E016", "Tanvi Shah", "R009", "D004", "T006", "Business", "Operations Manager", "tanvi.shah@example.com", "2021-07-15", "E010"],
  ["E017", "Yash Malhotra", "R010", "D001", "T001", "Technology", "Team Lead", "yash.malhotra@example.com", "2022-01-03", "E011"],
  ["E018", "Riya Kulkarni", "R010", "D001", "T002", "Technology", "Team Lead", "riya.kulkarni@example.com", "2022-01-04", "E012"],
  ["E019", "Harsh Vora", "R010", "D001", "T003", "Technology", "Team Lead", "harsh.vora@example.com", "2022-01-05", "E013"],
  ["E020", "Ananya Joshi", "R010", "D002", "T004", "Corporate", "HR Team Lead", "ananya.joshi@example.com", "2022-01-06", "E014"],
  ["E021", "Rahul Sharma", "R012", "D001", "T001", "Technology", "Backend Developer", "rahul.sharma@example.com", "2023-02-10", "E017"],
  ["E022", "Aditi Singh", "R012", "D001", "T001", "Technology", "Backend Developer", "aditi.singh@example.com", "2023-03-11", "E017"],
  ["E023", "Manish Yadav", "R012", "D001", "T001", "Technology", "Backend Developer", "manish.yadav@example.com", "2023-04-02", "E017"],
  ["E024", "Pooja Nair", "R012", "D001", "T002", "Technology", "Frontend Developer", "pooja.nair@example.com", "2023-04-20", "E018"],
  ["E025", "Dev Patel", "R012", "D001", "T002", "Technology", "Frontend Developer", "dev.patel@example.com", "2023-05-01", "E018"],
  ["E026", "Ira Sen", "R016", "D001", "T003", "Technology", "QA Engineer", "ira.sen@example.com", "2023-05-10", "E019"],
  ["E027", "Sahil Jain", "R017", "D001", "T011", "Technology", "DevOps Engineer", "sahil.jain@example.com", "2023-06-10", "E011"],
  ["E028", "Mihir Deshpande", "R017", "D001", "T011", "Technology", "DevOps Engineer", "mihir.d@example.com", "2023-07-01", "E011"],
  ["E029", "Zoya Khan", "R015", "D006", "T008", "Business", "Sales Executive", "zoya.khan@example.com", "2023-08-01", "E006"],
  ["E030", "Kabir Soni", "R019", "D005", "T007", "Business", "Marketing Executive", "kabir.soni@example.com", "2023-09-01", "E006"],
  ["E031", "Nisha Rao", "R013", "D002", "T004", "Corporate", "HR Executive", "nisha.rao@example.com", "2023-09-15", "E014"],
  ["E032", "Omkar Patil", "R014", "D003", "T005", "Corporate", "Finance Analyst", "omkar.patil@example.com", "2023-10-01", "E015"],
  ["E033", "Sana Sheikh", "R018", "D007", "T009", "Technology", "Security Analyst", "sana.sheikh@example.com", "2023-10-10", "E002"],
  ["E034", "Vivek Tiwari", "R020", "D008", "T010", "Corporate", "Admin Executive", "vivek.tiwari@example.com", "2023-11-01", "E010"],
  ["E035", "Neel Joshi", "R012", "D001", "T012", "Technology", "Data Engineer", "neel.joshi@example.com", "2024-01-15", "E013"],
  ["E036", "Maya Kapoor", "R012", "D001", "T012", "Technology", "Data Engineer", "maya.kapoor@example.com", "2024-02-01", "E013"]
] as const;

const permissions = [
  ["org:read", "Read organization hierarchy"],
  ["employee:read:self", "Read own employee profile"],
  ["employee:read:team", "Read direct and indirect reports"],
  ["employee:read:any", "Read all employee profiles"],
  ["workflow:read", "Read workflow requests"],
  ["workflow:write", "Create and decide workflow requests"],
  ["resource:read", "Read resource allocation recommendations"],
  ["analytics:read", "Read operational analytics"],
  ["admin:manage", "Manage organization and RBAC configuration"]
] as const;

const managementRoleIds = ["R001", "R002", "R003", "R004", "R005", "R006", "R007", "R008", "R009", "R010"];
const executiveRoleIds = ["R001", "R002", "R003", "R004", "R005", "R006"];

const skills = [
  ["S001", "React"], ["S002", "Node.js"], ["S003", "Python"], ["S004", "SQL"], ["S005", "AWS"], ["S006", "Docker"],
  ["S007", "Testing"], ["S008", "HR Operations"], ["S009", "Financial Analysis"], ["S010", "Project Management"],
  ["S011", "Cybersecurity"], ["S012", "Data Engineering"], ["S013", "Sales"], ["S014", "Digital Marketing"]
] as const;

const employeeSkills = [
  ["ES001", "E021", "S001", 95], ["ES002", "E021", "S002", 90], ["ES003", "E021", "S004", 90],
  ["ES004", "E022", "S002", 90], ["ES005", "E022", "S003", 88], ["ES006", "E022", "S004", 90],
  ["ES009", "E024", "S001", 95], ["ES010", "E024", "S007", 90], ["ES011", "E025", "S001", 90],
  ["ES012", "E025", "S007", 88], ["ES015", "E027", "S005", 92], ["ES016", "E027", "S006", 92],
  ["ES019", "E035", "S003", 93], ["ES020", "E035", "S004", 93], ["ES021", "E035", "S012", 93],
  ["ES025", "E033", "S011", 90], ["ES028", "E031", "S008", 90], ["ES029", "E032", "S009", 88]
] as const;

const projects = [
  ["P001", "Phoenix ERP", "D001", "2026-08-01", "2026-10-15", "Critical"],
  ["P002", "Apollo Mobile", "D001", "2026-09-01", "2026-11-30", "High"],
  ["P003", "Nexus Data Platform", "D001", "2026-08-15", "2026-12-15", "High"],
  ["P004", "HR Policy Refresh", "D002", "2026-08-20", "2026-09-30", "Medium"],
  ["P005", "Q4 Budget Planning", "D003", "2026-09-01", "2026-09-25", "High"],
  ["P006", "Operations Excellence", "D004", "2026-08-15", "2026-12-20", "Medium"]
] as const;

const projectMembers = [
  ["PM001", "P001", "E021", 80, "Backend Developer"], ["PM002", "P001", "E022", 60, "Backend Developer"],
  ["PM003", "P001", "E024", 70, "Frontend Developer"], ["PM004", "P002", "E025", 40, "Frontend Developer"],
  ["PM005", "P002", "E024", 30, "Frontend Developer"], ["PM006", "P003", "E035", 80, "Data Engineer"],
  ["PM007", "P003", "E036", 50, "Data Engineer"], ["PM008", "P001", "E027", 50, "DevOps Engineer"],
  ["PM009", "P001", "E026", 30, "QA Engineer"]
] as const;

const leaveBalances = [
  ["LB001", "E021", "Annual", 12, 4, 1, 7], ["LB002", "E021", "Sick", 8, 1, 0, 7],
  ["LB003", "E022", "Annual", 15, 6, 0, 9], ["LB004", "E024", "Annual", 12, 2, 0, 10],
  ["LB005", "E031", "Annual", 15, 8, 0, 7], ["LB006", "E027", "Annual", 12, 3, 0, 9]
] as const;

const workflowDefinitions = [["WF001", "Leave"], ["WF002", "Expense"], ["WF003", "Equipment"], ["WF004", "Software Access"], ["WF005", "Resource Allocation"], ["WF006", "Work From Home"]] as const;
const workflowSteps = [
  ["WS001", "WF001", 1, "Manager Approval", "Direct Manager", 24, "Optional"],
  ["WS002", "WF001", 2, "Department Review", "Department Head", 24, "Policy dependent"],
  ["WS003", "WF001", 3, "HR Review", "HR", 24, "Required"],
  ["WS004", "WF002", 1, "Manager Approval", "Direct Manager", 24, "Required"],
  ["WS005", "WF002", 2, "Finance Approval", "Finance", 48, "Required"],
  ["WS006", "WF003", 1, "Manager Approval", "Direct Manager", 24, "Optional"],
  ["WS007", "WF003", 2, "IT Review", "IT", 48, "Policy dependent"],
  ["WS008", "WF004", 1, "Manager Approval", "Direct Manager", 24, "Required"],
  ["WS009", "WF004", 2, "Security Review", "Security", 24, "Required"],
  ["WS010", "WF005", 1, "Manager Approval", "Direct Manager", 24, "Optional"],
  ["WS011", "WF005", 2, "Resource Review", "Resource Owner", 24, "Optional"],
  ["WS012", "WF006", 1, "Manager Approval", "Direct Manager", 24, "Optional"]
] as const;

const routingPolicyConfigs = [
  ["Leave", ["leaveType", "startDate", "endDate", "reason", "handoverEmployeeId"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Leave requires line-management approval"]], ["DEPARTMENT_HEAD", "Department Approval", null, 3, null, 1440, ["Leave longer than 3 days requires department approval"]], ["HR", "HR Approval", null, 7, null, 1440, ["Leave longer than 7 days requires HR validation"]]]],
  ["Attendance Correction", ["date", "currentPunch", "requestedPunch", "reason"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Attendance corrections require manager approval"]]]],
  ["Work From Home", ["startDate", "endDate", "reason", "meetings", "handover"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Work from home requires manager approval"]], ["HR", "HR Approval", null, 5, null, 1440, ["Extended work from home requires HR review"]]]],
  ["Remote Work", ["startDate", "endDate", "location", "reason", "consecutiveDays"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Remote work requires manager approval"]], ["HR", "HR Approval", null, 5, null, 1440, ["Extended remote work requires HR review"]]]],
  ["Expense", ["amount", "category", "projectId", "reason", "receipt"], [["DIRECT_MANAGER", "Manager Approval", null, null, 50000, 2880, ["Expenses require requester management approval"]], ["FINANCE", "Finance Approval", 10000, null, null, 2880, ["Expense amount exceeds finance threshold"]]]],
  ["Expense Reimbursement", ["amount", "currency", "category", "projectId", "reason", "receipt"], [["DIRECT_MANAGER", "Manager Approval", null, null, 50000, 2880, ["Reimbursements require management approval"]], ["DEPARTMENT_HEAD", "Department Approval", 50000, null, null, 2880, ["High-value reimbursement requires department authority"]], ["FINANCE", "Finance Approval", 10000, null, null, 2880, ["Reimbursement amount requires finance validation"]]]],
  ["Travel", ["startDate", "endDate", "destination", "travelType", "estimatedCost", "reason"], [["DIRECT_MANAGER", "Manager Approval", null, null, 50000, 2880, ["Travel requires manager approval"]], ["DEPARTMENT_HEAD", "Department Approval", 50000, null, null, 2880, ["High-cost travel requires department authority"]], ["FINANCE", "Finance Approval", 10000, null, null, 2880, ["Travel cost requires finance validation"]]]],
  ["Equipment", ["assetType", "businessNeed", "currentAssetAge", "projectId"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 4320, ["Equipment requests require business justification approval"]], ["IT", "IT Approval", null, null, null, 4320, ["Equipment requests require IT validation"]], ["FINANCE", "Finance Approval", 50000, null, null, 4320, ["High-value equipment requires finance approval"]]]],
  ["Asset Request", ["assetCategory", "amount", "businessNeed", "existingAssetId", "projectId"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 4320, ["Asset requests require business justification approval"]], ["IT", "IT Approval", null, null, null, 4320, ["Asset provisioning requires IT validation"]], ["FINANCE", "Finance Approval", 50000, null, null, 4320, ["High-value asset requests require finance approval"]]]],
  ["IT Access Request", ["system", "permission", "riskLevel", "applicationOwnerId", "reason", "incidentTicket"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["IT access requires management approval"]], ["IT", "IT/Security Approval", null, null, null, 1440, ["IT access requires system/security owner approval"]]]],
  ["Software Access", ["system", "permission", "riskLevel", "reason", "incidentTicket"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Software access requires management approval"]], ["IT", "IT/Security Approval", null, null, null, 1440, ["Software access requires IT validation"]]]],
  ["Purchase Request", ["amount", "currency", "category", "vendor", "costCenter", "reason"], [["DIRECT_MANAGER", "Manager Approval", null, null, 50000, 4320, ["Purchase requests require management approval"]], ["DEPARTMENT_HEAD", "Department Approval", null, null, null, 4320, ["Purchase requests require department authority"]], ["FINANCE", "Finance Approval", null, null, null, 4320, ["Purchase requests require finance validation"]], ["PROCUREMENT", "Procurement Approval", null, null, null, 4320, ["Purchase requests require procurement handling"]]]],
  ["Training Request", ["trainingName", "trainingCategory", "amount", "mandatory", "reason"], [["DIRECT_MANAGER", "Manager Approval", null, null, 50000, 2880, ["Training requests require manager approval"]], ["DEPARTMENT_HEAD", "Department Approval", 25000, null, null, 2880, ["High-cost training requires department authority"]], ["HR", "HR/L&D Approval", 25000, null, null, 2880, ["High-cost training requires HR/L&D validation"]]]],
  ["Resource Allocation", ["requiredSkill", "startDate", "endDate", "projectId", "allocationPct"], [["PROJECT_MANAGER", "Project Approval", null, null, null, 2880, ["Resource allocation requires project authority"]], ["DEPARTMENT_HEAD", "Resource Owner Approval", null, null, null, 2880, ["Resource allocation requires resource owner validation"]]]],
  ["Resource Request", ["requiredSkill", "requiredRole", "projectId", "allocationPct", "priority", "deadline"], [["PROJECT_MANAGER", "Project Approval", null, null, null, 2880, ["Resource requests require project authority"]], ["DEPARTMENT_HEAD", "Resource Owner Approval", null, null, null, 2880, ["Resource requests require resource owner validation"]]]],
  ["Overtime Request", ["date", "hours", "reason", "payrollImpact"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Overtime requires manager approval"]], ["HR", "HR/Payroll Approval", null, null, null, 1440, ["Overtime requires HR/payroll validation"]]]],
  ["Shift Change", ["currentShift", "requestedShift", "date", "reason", "staffingImpact"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 1440, ["Shift changes require manager approval"]]]],
  ["Transfer", ["targetDepartmentId", "targetTeamId", "reason", "targetManagerId"], [["DIRECT_MANAGER", "Current Manager Approval", null, null, null, 2880, ["Transfers require current manager approval"]], ["DEPARTMENT_HEAD", "Department Approval", null, null, null, 2880, ["Transfers require department authority"]], ["HR", "HR Approval", null, null, null, 2880, ["Transfers require HR validation"]]]],
  ["Transfer Request", ["targetDepartmentId", "targetTeamId", "reason", "targetManagerId"], [["DIRECT_MANAGER", "Current Manager Approval", null, null, null, 2880, ["Transfer requests require current manager approval"]], ["DEPARTMENT_HEAD", "Department Approval", null, null, null, 2880, ["Transfer requests require department authority"]], ["HR", "HR Approval", null, null, null, 2880, ["Transfer requests require HR validation"]]]],
  ["Promotion Request", ["currentDesignation", "proposedDesignation", "grade", "reason"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 2880, ["Promotions require manager approval"]], ["DEPARTMENT_HEAD", "Department Approval", null, null, null, 2880, ["Promotions require department authority"]], ["HR", "HR Approval", null, null, null, 2880, ["Promotions require HR validation"]]]],
  ["Salary Revision", ["currentSalary", "proposedSalary", "grade", "reason", "budgetImpact"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 2880, ["Salary revisions require manager approval"]], ["DEPARTMENT_HEAD", "Department Approval", null, null, null, 2880, ["Salary revisions require department authority"]], ["HR", "HR/Compensation Approval", null, null, null, 2880, ["Salary revisions require HR compensation validation"]], ["FINANCE", "Finance Approval", null, null, null, 2880, ["Salary revisions require finance validation"]]]],
  ["Employee Data Change", ["changeType", "sensitive", "currentValue", "requestedValue", "reason"], [["HR", "HR Approval", null, null, null, 1440, ["Employee data changes require HR validation"]]]],
  ["Document Request", ["documentType", "purpose", "deliveryFormat", "reason"], [["HR", "HR Approval", null, null, null, 1440, ["Document requests require HR handling"]]]],
  ["Resignation", ["lastWorkingDate", "reason", "noticePeriod", "handoverPlan"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 2880, ["Resignations require manager acknowledgement"]], ["HR", "HR Approval", null, null, null, 2880, ["Resignations require HR processing"]]]],
  ["Project Allocation", ["projectId", "allocationPct", "startDate", "endDate", "role"], [["PROJECT_MANAGER", "Project Approval", null, null, null, 2880, ["Project allocation requires project authority"]], ["DEPARTMENT_HEAD", "Resource Owner Approval", null, null, null, 2880, ["Project allocation requires resource owner validation"]]]],
  ["Timesheet Correction", ["date", "projectId", "currentHours", "requestedHours", "reason"], [["PROJECT_MANAGER", "Project Manager Approval", null, null, null, 1440, ["Timesheet corrections require project or manager approval"]]]],
  ["Other", ["title", "reason", "supportingDetails"], [["DIRECT_MANAGER", "Manager Approval", null, null, null, 2880, ["Default requests require manager approval"]]]]
] as const;

const requests = [
  ["REQ001", "E021", "Leave", "Pending Approval", "High", "Leave - family function", "2026-09-10", "2026-09-13", "Family function", "2026-08-21T09:15:00", "E017"],
  ["REQ003", "E022", "Expense", "Pending Finance", "Medium", "Client travel reimbursement", null, null, "Customer visit to Bengaluru", "2026-08-19T15:10:00", "E015"],
  ["REQ004", "E023", "Equipment", "Processing", "High", "Laptop replacement", "2026-08-22", null, "Device older than policy", "2026-08-18T11:00:00", "E034"],
  ["REQ005", "E033", "Software Access", "Pending Security", "Critical", "AWS production access", "2026-08-21", null, "Production incident support", "2026-08-20T16:40:00", "E033"],
  ["REQ006", "E025", "Resource Allocation", "Pending Approval", "High", "Allocation to Apollo", "2026-09-01", "2026-09-21", "React capacity needed", "2026-08-21T08:30:00", "E018"],
  ["REQ010", "E027", "Work From Home", "Escalated", "High", "WFH - service appointment", "2026-08-21", "2026-08-21", "Service appointment", "2026-08-19T09:30:00", "E011"]
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("OrgFlow@123", 10);

  await prisma.organization.upsert({
    where: { id: "ORG001" },
    update: {},
    create: { id: "ORG001", name: "Demo Enterprise", timezone: "Asia/Kolkata" }
  });

  for (const [id, name, level] of roles) {
    await prisma.role.upsert({ where: { id }, update: { name, level }, create: { id, name, level } });
  }

  for (const [id, name, groupName, executiveRole] of departments) {
    await prisma.department.upsert({
      where: { id },
      update: { name, groupName, executiveRole },
      create: { id, name, groupName, executiveRole, organizationId: "ORG001" }
    });
  }

  for (const [id, name, departmentId] of teams) {
    await prisma.team.upsert({
      where: { id },
      update: { name, departmentId },
      create: { id, name, departmentId }
    });
  }

  for (const [id, name, roleId, departmentId, teamId, businessUnit, designation, email, hireDate] of employees) {
    await prisma.employee.upsert({
      where: { id },
      update: { name, roleId, departmentId, teamId, businessUnit, designation, email, hireDate: new Date(hireDate) },
      create: {
        id,
        organizationId: "ORG001",
        name,
        roleId,
        departmentId,
        teamId,
        businessUnit,
        designation,
        email,
        hireDate: new Date(hireDate)
      }
    });
  }

  for (const [id, , , , , , , , , managerId] of employees) {
    await prisma.employee.update({ where: { id }, data: { managerId } });
  }

  for (const [id, description] of permissions) {
    await prisma.permission.upsert({ where: { id }, update: { description }, create: { id, description } });
  }

  for (const [roleId] of roles) {
    const rolePermissions = ["org:read", "employee:read:self"];
    rolePermissions.push("workflow:read", "workflow:write", "resource:read");
    if (managementRoleIds.includes(roleId)) rolePermissions.push("employee:read:team");
    if (executiveRoleIds.includes(roleId) || roleId === "R020") rolePermissions.push("employee:read:any", "analytics:read");
    if (roleId === "R001" || roleId === "R020") rolePermissions.push("admin:manage");

    for (const permissionId of rolePermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId }
      });
    }
  }

  for (const [employeeId, , , , , , , email] of employees) {
    if (!email) continue;
    await prisma.userAccount.upsert({
      where: { employeeId },
      update: { email, passwordHash, status: "Active" },
      create: {
        id: `U${employeeId.slice(1).padStart(3, "0")}`,
        employeeId,
        email,
        passwordHash,
        status: "Active"
      }
    });
  }

  for (const [employeeId, , roleId, departmentId, teamId, businessUnit] of employees) {
    const userId = `U${employeeId.slice(1).padStart(3, "0")}`;
    await prisma.userRole.upsert({
      where: { id: `UR-${employeeId}` },
      update: { active: true, businessUnit, departmentId, teamId },
      create: {
        id: `UR-${employeeId}`,
        userId,
        roleId,
        organizationId: "ORG001",
        businessUnit,
        departmentId,
        teamId,
        active: true
      }
    });
  }

  for (const [id, name] of skills) {
    await prisma.skill.upsert({ where: { id }, update: { name }, create: { id, name } });
  }

  for (const [id, employeeId, skillId, proficiency] of employeeSkills) {
    await prisma.employeeSkill.upsert({
      where: { id },
      update: { employeeId, skillId, proficiency },
      create: { id, employeeId, skillId, proficiency }
    });
  }

  for (const [id, name, departmentId, startDate, endDate, priority] of projects) {
    await prisma.project.upsert({
      where: { id },
      update: { name, departmentId, startDate: new Date(startDate), endDate: new Date(endDate), priority },
      create: { id, name, departmentId, startDate: new Date(startDate), endDate: new Date(endDate), priority }
    });
  }

  for (const [id, projectId, employeeId, allocationPct, projectRole] of projectMembers) {
    await prisma.projectMember.upsert({
      where: { id },
      update: { projectId, employeeId, allocationPct, projectRole },
      create: { id, projectId, employeeId, allocationPct, projectRole }
    });
  }

  for (const [id, employeeId, leaveType, entitlement, usedDays, pendingDays, availableDays] of leaveBalances) {
    await prisma.leaveBalance.upsert({
      where: { id },
      update: { employeeId, leaveType, entitlement, usedDays, pendingDays, availableDays },
      create: { id, employeeId, leaveType, entitlement, usedDays, pendingDays, availableDays }
    });
  }

  for (const [employeeId] of employees) {
    for (const leave of [
      { leaveType: "Annual", entitlement: 12, usedDays: 0, pendingDays: 0, availableDays: 12 },
      { leaveType: "Sick", entitlement: 8, usedDays: 0, pendingDays: 0, availableDays: 8 }
    ]) {
      const existing = await prisma.leaveBalance.findFirst({ where: { employeeId, leaveType: leave.leaveType } });
      if (!existing) {
        await prisma.leaveBalance.create({
          data: {
            id: `LB-${employeeId}-${leave.leaveType.slice(0, 2).toUpperCase()}`,
            employeeId,
            ...leave
          }
        });
      }
    }
  }

  for (const [id, requestType] of workflowDefinitions) {
    await prisma.workflowDefinition.upsert({
      where: { id },
      update: { requestType, version: 1, active: true },
      create: { id, requestType, version: 1, active: true }
    });
  }

  for (const [id, workflowId, order, name, approverType, slaHours, proofRequired] of workflowSteps) {
    await prisma.workflowStep.upsert({
      where: { id },
      update: { workflowId, order, name, approverType, slaHours, proofRequired },
      create: { id, workflowId, order, name, approverType, slaHours, proofRequired }
    });
  }

  await seedRoutingPolicyConfiguration();

  for (const [id, employeeId, requestType, status, priority, title, startDate, endDate, reason, createdAt, currentOwnerId] of requests) {
    await prisma.request.upsert({
      where: { id },
      update: { employeeId, requestType, status, priority, title, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, reason, createdAt: new Date(createdAt), currentOwnerId },
      create: { id, organizationId: "ORG001", employeeId, requestType, status, priority, title, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, reason, createdAt: new Date(createdAt), currentOwnerId }
    });
  }

  const contextRows = [
    ["REQ001", "leave_balance", "7 annual days available", "ERP"], ["REQ001", "current_project", "P001 Phoenix ERP, 80% allocation", "ERP"],
    ["REQ001", "upcoming_project", "P002 Apollo Mobile starts 2026-09-01", "ERP"], ["REQ001", "team_impact", "1 teammate also on leave; estimated team capacity 72%", "Derived"],
    ["REQ003", "expense_amount", "18500 INR", "Request"], ["REQ003", "department_budget", "120000 INR remaining", "ERP"],
    ["REQ005", "risk_level", "HIGH", "Derived"], ["REQ006", "candidate_E025", "Skill 90%; current allocation 40%; available capacity 60%", "Derived"],
    ["REQ010", "escalation", "SLA exceeded and escalated to Senior Manager", "System"]
  ] as const;
  for (const [requestId, key, value, sourceType] of contextRows) {
    const existing = await prisma.requestContext.findFirst({ where: { requestId, key } });
    if (existing) await prisma.requestContext.update({ where: { id: existing.id }, data: { value, sourceType } });
    else await prisma.requestContext.create({ data: { requestId, key, value, sourceType } });
  }

  const approvals = [
    ["APR001", "REQ001", "E017", "Manager", "Pending", null, "Leave conflicts with project milestone"],
    ["APR003", "REQ003", "E015", "Finance", "Pending", "2026-08-20T16:00:00", "Budget validation pending"],
    ["APR004", "REQ004", "E015", "Manager", "Approved", "2026-08-18T14:00:00", "Replacement justified"],
    ["APR005", "REQ005", "E033", "Security", "Pending", "2026-08-20T17:00:00", "Security review required"],
    ["APR006", "REQ006", "E018", "Manager", "Pending", null, "Apollo capacity review"],
    ["APR010", "REQ010", "E011", "Manager", "Escalated", "2026-08-20T10:30:00", "SLA exceeded"]
  ] as const;
  for (const [id, requestId, approverId, stage, status, actionAt, comments] of approvals) {
    await prisma.approval.upsert({
      where: { id },
      update: { requestId, approverId, stage, status, actionAt: actionAt ? new Date(actionAt) : null, comments },
      create: { id, requestId, approverId, stage, status, actionAt: actionAt ? new Date(actionAt) : null, comments }
    });
  }

  const resources = [
    ["RES001", "Laptop - Standard", "Equipment", "IT-1001", "Available", 120000],
    ["RES002", "Laptop - Developer Pro", "Equipment", "IT-1002", "Allocated", 180000],
    ["RES003", "Meeting Room A", "Facility", "RM-A", "Available", null],
    ["RES004", "AWS Production Access", "Digital", "AWS-PROD", "Restricted", null],
    ["RES005", "Figma Enterprise Seat", "Digital", "FIGMA-ENT", "Available", 2500],
    ["RES006", "React Specialist", "Human", "E025", "Available", null]
  ] as const;
  for (const [id, name, type, reference, status, cost] of resources) {
    await prisma.resource.upsert({ where: { id }, update: { name, type, reference, status, cost }, create: { id, name, type, reference, status, cost } });
  }

  const attachments = [["ATT001", "REQ001", "leave_supporting_note.pdf", false], ["ATT002", "REQ003", "travel_receipt.pdf", true], ["ATT003", "REQ004", "device_diagnostics.pdf", true], ["ATT004", "REQ005", "incident_ticket.pdf", true]] as const;
  for (const [id, requestId, fileName, isRequired] of attachments) {
    await prisma.attachment.upsert({ where: { id }, update: { requestId, fileName, isRequired }, create: { id, requestId, fileName, isRequired } });
  }

  const notifications = [["N001", "E017", "REQ001", "Approval required for Rahul leave request", "Unread", "2026-08-21T09:16:00"], ["N003", "E015", "REQ003", "Finance approval required", "Unread", "2026-08-20T16:01:00"], ["N004", "E033", "REQ005", "Security review required", "Unread", "2026-08-20T17:02:00"], ["N005", "E011", "REQ010", "Request escalated", "Read", "2026-08-20T10:31:00"]] as const;
  for (const [id, recipientEmployeeId, requestId, message, status, createdAt] of notifications) {
    await prisma.notification.upsert({ where: { id }, update: { recipientEmployeeId, requestId, message, status, createdAt: new Date(createdAt) }, create: { id, recipientEmployeeId, requestId, message, status, createdAt: new Date(createdAt) } });
  }

  const audits = [["AUD001", "REQ001", "E021", "REQUEST_SUBMITTED", "2026-08-21T09:15:00", "Leave request submitted"], ["AUD002", "REQ001", null, "ROUTED", "2026-08-21T09:16:00", "Routed to Team Lead E017"], ["AUD004", "REQ004", "E015", "APPROVED", "2026-08-18T14:00:00", "Manager approval completed"], ["AUD005", "REQ010", null, "ESCALATED", "2026-08-20T10:30:00", "SLA exceeded and escalated"]] as const;
  for (const [id, requestId, actorId, eventType, eventAt, details] of audits) {
    await prisma.auditLog.upsert({ where: { id }, update: { requestId, actorId, eventType, eventAt: new Date(eventAt), details }, create: { id, requestId, actorId, eventType, eventAt: new Date(eventAt), details } });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(`Seeded ${employees.length} employees with demo password OrgFlow@123`);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

async function seedRoutingPolicyConfiguration() {
  for (const [type, fields, requirements] of routingPolicyConfigs) {
    const key = normalizePolicyKey(type);
    const requestTypeId = `RTC-${key}`.slice(0, 40);
    const policyId = `POL-${key}`.slice(0, 40);

    await prisma.$executeRaw`
      INSERT INTO request_type_configs
        (request_type_config_id, organization_id, \`key\`, name, fields_json, active, created_at, updated_at)
      VALUES
        (${requestTypeId}, 'ORG001', ${key}, ${type}, ${JSON.stringify(fields)}, true, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        fields_json = VALUES(fields_json),
        active = VALUES(active),
        updated_at = NOW(3)
    `;

    await prisma.$executeRaw`
      INSERT INTO routing_policy_configs
        (routing_policy_id, organization_id, request_type_key, name, version, active, conditions_json, created_at, updated_at)
      VALUES
        (${policyId}, 'ORG001', ${key}, ${`${type} default routing policy`}, 1, true, NULL, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        version = VALUES(version),
        active = VALUES(active),
        updated_at = NOW(3)
    `;

    for (const [index, requirement] of requirements.entries()) {
      const [source, label, conditionAmountGt, conditionDurationGt, minimumApprovalLimit, slaMinutes, reasons] = requirement;
      const requirementId = `${policyId}-R${String(index + 1).padStart(2, "0")}`.slice(0, 40);
      await prisma.$executeRaw`
        INSERT INTO approval_requirement_configs
          (approval_requirement_id, routing_policy_id, requirement_key, source, label, step_sequence, mode, condition_amount_gt, condition_duration_days_gt, minimum_approval_limit, sla_minutes, policy_reasons_json, active)
        VALUES
          (${requirementId}, ${policyId}, ${`${index + 1}-${source}`}, ${source}, ${label}, ${index + 1}, 'Sequential', ${conditionAmountGt}, ${conditionDurationGt}, ${minimumApprovalLimit}, ${slaMinutes}, ${JSON.stringify(reasons)}, true)
        ON DUPLICATE KEY UPDATE
          source = VALUES(source),
          label = VALUES(label),
          step_sequence = VALUES(step_sequence),
          mode = VALUES(mode),
          condition_amount_gt = VALUES(condition_amount_gt),
          condition_duration_days_gt = VALUES(condition_duration_days_gt),
          minimum_approval_limit = VALUES(minimum_approval_limit),
          sla_minutes = VALUES(sla_minutes),
          policy_reasons_json = VALUES(policy_reasons_json),
          active = VALUES(active)
      `;
    }

    await prisma.$executeRaw`
      INSERT INTO sla_policy_configs
        (sla_policy_config_id, organization_id, request_type_key, duration_minutes, reminder_percent, escalation_source, active)
      VALUES
        (${`SLA-${key}`.slice(0, 40)}, 'ORG001', ${key}, ${defaultSlaMinutes(key)}, 80, 'BUSINESS_UNIT_HEAD', true)
      ON DUPLICATE KEY UPDATE
        duration_minutes = VALUES(duration_minutes),
        reminder_percent = VALUES(reminder_percent),
        escalation_source = VALUES(escalation_source),
        active = VALUES(active)
    `;
  }

  await prisma.$executeRaw`
    INSERT INTO delegation_rules
      (delegation_rule_id, organization_id, delegator_id, delegate_id, start_at, end_at, request_types_json, department_id, reason, active)
    VALUES
      ('DEL-DEMO-E011-E017', 'ORG001', 'E011', 'E017', '2026-08-20 00:00:00.000', '2026-08-30 23:59:59.000', ${JSON.stringify(["LEAVE", "WORK_FROM_HOME", "ATTENDANCE_CORRECTION"])}, 'D001', 'Demo delegation for line-management requests during scheduled absence', true)
    ON DUPLICATE KEY UPDATE
      start_at = VALUES(start_at),
      end_at = VALUES(end_at),
      request_types_json = VALUES(request_types_json),
      department_id = VALUES(department_id),
      reason = VALUES(reason),
      active = VALUES(active)
  `;
}

function normalizePolicyKey(type: string) {
  return type.trim().replaceAll(" ", "_").toUpperCase();
}

function defaultSlaMinutes(key: string) {
  if (["LEAVE", "WORK_FROM_HOME", "REMOTE_WORK", "ATTENDANCE_CORRECTION", "IT_ACCESS_REQUEST", "SOFTWARE_ACCESS"].includes(key)) return 24 * 60;
  if (["PURCHASE_REQUEST", "ASSET_REQUEST", "EQUIPMENT"].includes(key)) return 72 * 60;
  return 48 * 60;
}
