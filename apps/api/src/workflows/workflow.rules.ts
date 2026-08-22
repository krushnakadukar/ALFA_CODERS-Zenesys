export const requestTypeSchemas = [
  {
    type: "Leave",
    fields: ["leaveType", "startDate", "endDate", "reason", "handoverEmployeeId"],
    proof: "Policy dependent",
    route: "Direct Manager; Department Head for more than 2 days; HR for more than 7 days"
  },
  {
    type: "Attendance Correction",
    fields: ["date", "currentPunch", "requestedPunch", "reason"],
    proof: "Optional",
    route: "Direct Manager; delegated manager when unavailable"
  },
  {
    type: "Work From Home",
    fields: ["startDate", "endDate", "reason", "meetings", "handover"],
    proof: "Optional",
    route: "Direct Manager"
  },
  {
    type: "Remote Work",
    fields: ["startDate", "endDate", "location", "reason", "consecutiveDays"],
    proof: "Optional",
    route: "Manager; HR when policy thresholds are exceeded"
  },
  {
    type: "Expense",
    fields: ["amount", "category", "projectId", "reason", "receipt"],
    proof: "Required",
    route: "Manager + Finance when amount exceeds 10000 INR"
  },
  {
    type: "Expense Reimbursement",
    fields: ["amount", "currency", "category", "projectId", "reason", "receipt"],
    proof: "Required",
    route: "Manager + Department Head + Finance based on amount"
  },
  {
    type: "Travel",
    fields: ["startDate", "endDate", "destination", "travelType", "estimatedCost", "reason"],
    proof: "Required",
    route: "Manager + Finance; additional approvals for international/high-cost travel"
  },
  {
    type: "Equipment",
    fields: ["assetType", "businessNeed", "currentAssetAge", "projectId"],
    proof: "Policy dependent",
    route: "Manager + IT"
  },
  {
    type: "Asset Request",
    fields: ["assetCategory", "amount", "businessNeed", "existingAssetId", "projectId"],
    proof: "Policy dependent",
    route: "Manager + IT + Finance when value exceeds threshold"
  },
  {
    type: "IT Access Request",
    fields: ["system", "permission", "riskLevel", "applicationOwnerId", "reason", "incidentTicket"],
    proof: "Required",
    route: "Manager + Application Owner + Security/IT for privileged access"
  },
  {
    type: "Software Access",
    fields: ["system", "permission", "riskLevel", "reason", "incidentTicket"],
    proof: "Required",
    route: "Manager + Security"
  },
  {
    type: "Purchase Request",
    fields: ["amount", "currency", "category", "vendor", "costCenter", "reason"],
    proof: "Required",
    route: "Manager + Department Head + Finance + Procurement"
  },
  {
    type: "Training Request",
    fields: ["trainingName", "trainingCategory", "amount", "mandatory", "reason"],
    proof: "Optional",
    route: "Manager; Department Head and HR/L&D when cost threshold is exceeded"
  },
  {
    type: "Resource Allocation",
    fields: ["requiredSkill", "startDate", "endDate", "projectId", "allocationPct"],
    proof: "Optional",
    route: "Manager + Resource Owner"
  },
  {
    type: "Resource Request",
    fields: ["requiredSkill", "requiredRole", "projectId", "allocationPct", "priority", "deadline"],
    proof: "Optional",
    route: "Project Manager + Resource Owner"
  },
  {
    type: "Overtime Request",
    fields: ["date", "hours", "reason", "payrollImpact"],
    proof: "Optional",
    route: "Manager + HR/Payroll when policy requires"
  },
  {
    type: "Shift Change",
    fields: ["currentShift", "requestedShift", "date", "reason", "staffingImpact"],
    proof: "Optional",
    route: "Manager; route to exception when staffing is invalid"
  },
  {
    type: "Transfer",
    fields: ["targetDepartmentId", "targetTeamId", "reason", "targetManagerId"],
    proof: "Optional",
    route: "Current Manager + HR + Target Department"
  },
  {
    type: "Transfer Request",
    fields: ["targetDepartmentId", "targetTeamId", "reason", "targetManagerId"],
    proof: "Optional",
    route: "Current Manager + Current Department Head + Receiving Manager + HR"
  },
  {
    type: "Promotion Request",
    fields: ["currentDesignation", "proposedDesignation", "grade", "reason"],
    proof: "Required",
    route: "Manager + Department Head + HR"
  },
  {
    type: "Salary Revision",
    fields: ["currentSalary", "proposedSalary", "grade", "reason", "budgetImpact"],
    proof: "Required",
    route: "Manager + Department Head + HR/Compensation + Finance"
  },
  {
    type: "Employee Data Change",
    fields: ["changeType", "sensitive", "currentValue", "requestedValue", "reason"],
    proof: "Policy dependent",
    route: "Manager and HR for sensitive changes"
  },
  {
    type: "Document Request",
    fields: ["documentType", "purpose", "deliveryFormat", "reason"],
    proof: "Optional",
    route: "HR"
  },
  {
    type: "Resignation",
    fields: ["lastWorkingDate", "reason", "noticePeriod", "handoverPlan"],
    proof: "Optional",
    route: "Manager + HR; senior leaders use executive authority"
  },
  {
    type: "Project Allocation",
    fields: ["projectId", "allocationPct", "startDate", "endDate", "role"],
    proof: "Optional",
    route: "Project Manager + Resource Owner"
  },
  {
    type: "Timesheet Correction",
    fields: ["date", "projectId", "currentHours", "requestedHours", "reason"],
    proof: "Optional",
    route: "Manager / Project Manager; never self-approved"
  },
  {
    type: "Other",
    fields: ["title", "reason", "supportingDetails"],
    proof: "Optional",
    route: "Direct Manager"
  }
];

export function proofRequiredFor(type: string, payload: Record<string, unknown>) {
  if (["Expense", "Expense Reimbursement", "IT Access Request", "Software Access", "Travel", "Purchase Request", "Promotion Request", "Salary Revision"].includes(type)) return true;
  if (["Equipment", "Asset Request"].includes(type)) return Number(payload.currentAssetAge ?? payload.amount ?? 0) >= 3;
  if (type === "Leave") return payload.leaveType === "Sick";
  if (type === "Employee Data Change") return Boolean(payload.sensitive);
  return false;
}

export function priorityFor(type: string, payload: Record<string, unknown>) {
  if (["IT Access Request", "Software Access"].includes(type) || payload.riskLevel === "HIGH") return "Critical";
  if (["Expense", "Expense Reimbursement", "Purchase Request", "Asset Request"].includes(type) && Number(payload.amount ?? 0) > 10000) return "High";
  return String(payload.priority ?? "Medium");
}
