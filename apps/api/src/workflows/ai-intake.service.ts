import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { AiService, type AiProvider, type AiSuggestionRepository, type AiValidationResult } from "../production/ai.provider.js";
import type { AiRequest, AiResult } from "../production/domain.js";
import type { AuthUser } from "../types.js";
import { priorityFor, requestTypeSchemas } from "./workflow.rules.js";

type IntakeInput = {
  prompt: string;
  context?: Record<string, unknown>;
  requestId?: string;
};

export async function suggestIntake(user: AuthUser, input: IntakeInput) {
  const request: AiRequest = {
    organizationId: user.organizationId,
    employeeId: user.employeeId,
    capability: "RequestClassification",
    prompt: input.prompt,
    context: input.context
  };
  const service = new AiService(new RuleBasedIntakeProvider(), validateIntakeSuggestion, new PrismaAiSuggestionRepository(input.requestId));
  return service.suggest(request);
}

class RuleBasedIntakeProvider implements AiProvider {
  providerName = "deterministic-rules";
  model = "orgflow-intake-rules-v1";

  async complete(request: AiRequest): Promise<AiResult> {
    const prompt = request.prompt.toLowerCase();
    const type = classifyRequestType(prompt);
    const fields = requestTypeSchemas.find((schema) => schema.type === type)?.fields ?? [];
    const output: Record<string, unknown> = {
      type,
      priority: priorityFor(type, request.context ?? {}),
      fields: Object.fromEntries(fields.map((field) => [field, request.context?.[field] ?? null])),
      missingFields: fields.filter((field) => request.context?.[field] == null),
      route: requestTypeSchemas.find((schema) => schema.type === type)?.route
    };
    return {
      provider: this.providerName,
      model: this.model,
      output,
      confidence: confidenceFor(type, prompt)
    };
  }
}

class PrismaAiSuggestionRepository implements AiSuggestionRepository {
  constructor(private readonly requestId?: string) {}

  async saveSuggestion(input: {
    request: AiRequest;
    result: AiResult;
    validation: AiValidationResult;
    advisoryOnly: boolean;
    requiresRuleValidation: boolean;
  }) {
    const id = `AIS-${randomUUID()}`;
    await prisma.$executeRaw`
      INSERT INTO ai_suggestions
        (ai_suggestion_id, organization_id, employee_id, request_id, provider, model, capability, prompt, output_json, confidence, advisory_only, validation_status, validation_errors_json, accepted, created_at)
      VALUES
        (${id}, ${input.request.organizationId}, ${input.request.employeeId ?? null}, ${this.requestId ?? null}, ${input.result.provider}, ${input.result.model}, ${input.request.capability}, ${input.request.prompt}, ${JSON.stringify(input.result.output)}, ${input.result.confidence ?? null}, ${input.advisoryOnly}, ${input.validation.status}, ${JSON.stringify(input.validation.errors)}, NULL, NOW(3))
    `;
    return id;
  }
}

export function validateIntakeSuggestion(result: AiResult, _request: AiRequest): AiValidationResult {
  const errors = [];
  const type = typeof result.output.type === "string" ? result.output.type : "";
  const schema = requestTypeSchemas.find((item) => item.type === type);
  if (!schema) errors.push(`Unsupported request type: ${type || "missing"}`);

  const outputFields = result.output.fields && typeof result.output.fields === "object" ? result.output.fields as Record<string, unknown> : {};
  const missingFields = schema ? schema.fields.filter((field) => outputFields[field] == null) : [];
  if (missingFields.length > 0) errors.push(`Missing fields: ${missingFields.join(", ")}`);

  const confidence = result.confidence ?? 0;
  if (confidence < 0.5) errors.push("AI confidence below deterministic acceptance threshold");

  return {
    status: errors.length === 0 ? "Valid" : schema ? "NeedsReview" : "Invalid",
    errors,
    normalizedOutput: {
      ...result.output,
      type: schema?.type ?? type,
      missingFields
    }
  };
}

function classifyRequestType(lowerPrompt: string) {
  if (lowerPrompt.includes("resign") || lowerPrompt.includes("notice period")) return "Resignation";
  if (lowerPrompt.includes("salary") || lowerPrompt.includes("compensation")) return "Salary Revision";
  if (lowerPrompt.includes("promotion") || lowerPrompt.includes("designation")) return "Promotion Request";
  if (lowerPrompt.includes("transfer") || lowerPrompt.includes("department change")) return "Transfer Request";
  if (lowerPrompt.includes("timesheet")) return "Timesheet Correction";
  if (lowerPrompt.includes("shift")) return "Shift Change";
  if (lowerPrompt.includes("overtime")) return "Overtime Request";
  if (lowerPrompt.includes("training") || lowerPrompt.includes("course")) return "Training Request";
  if (lowerPrompt.includes("purchase") || lowerPrompt.includes("vendor")) return "Purchase Request";
  if (lowerPrompt.includes("travel") || lowerPrompt.includes("flight") || lowerPrompt.includes("hotel")) return "Travel";
  if (lowerPrompt.includes("expense") || lowerPrompt.includes("receipt") || lowerPrompt.includes("reimbursement")) return "Expense Reimbursement";
  if (lowerPrompt.includes("laptop") || lowerPrompt.includes("asset") || lowerPrompt.includes("equipment")) return "Asset Request";
  if (lowerPrompt.includes("access") || lowerPrompt.includes("aws") || lowerPrompt.includes("permission")) return "IT Access Request";
  if (lowerPrompt.includes("software") || lowerPrompt.includes("license")) return "Software Access";
  if (lowerPrompt.includes("resource") || lowerPrompt.includes("allocation") || lowerPrompt.includes("developer")) return "Resource Request";
  if (lowerPrompt.includes("attendance") || lowerPrompt.includes("punch")) return "Attendance Correction";
  if (lowerPrompt.includes("remote")) return "Remote Work";
  if (lowerPrompt.includes("leave") || lowerPrompt.includes("vacation") || lowerPrompt.includes("sick")) return "Leave";
  if (lowerPrompt.includes("document") || lowerPrompt.includes("letter") || lowerPrompt.includes("certificate")) return "Document Request";
  if (lowerPrompt.includes("bank") || lowerPrompt.includes("address") || lowerPrompt.includes("phone")) return "Employee Data Change";
  return "Work From Home";
}

function confidenceFor(type: string, prompt: string) {
  if (type === "Work From Home" && !prompt.includes("work from home") && !prompt.includes("wfh")) return 0.58;
  return 0.91;
}
