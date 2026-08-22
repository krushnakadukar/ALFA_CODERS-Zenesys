import { describe, expect, it } from "vitest";
import { validateIntakeSuggestion } from "../src/workflows/ai-intake.service.js";
import type { AiRequest, AiResult } from "../src/production/domain.js";

const request: AiRequest = {
  organizationId: "ORG1",
  employeeId: "E1",
  capability: "RequestClassification",
  prompt: "Need a laptop",
  context: {}
};

describe("production AI intake validation", () => {
  it("keeps complete supported suggestions advisory but valid", () => {
    const result = aiResult({
      type: "Asset Request",
      fields: {
        assetCategory: "Laptop",
        amount: 75000,
        businessNeed: "Engineering work",
        existingAssetId: "OLD-LAPTOP-42",
        projectId: "P001"
      }
    });

    const validation = validateIntakeSuggestion(result, request);

    expect(validation.status).toBe("Valid");
    expect(validation.errors).toEqual([]);
    expect(validation.normalizedOutput.missingFields).toEqual([]);
  });

  it("requires deterministic review when required request fields are missing", () => {
    const result = aiResult({
      type: "Expense Reimbursement",
      fields: {
        amount: 85000,
        currency: "INR"
      }
    });

    const validation = validateIntakeSuggestion(result, request);

    expect(validation.status).toBe("NeedsReview");
    expect(validation.errors.join(" ")).toContain("Missing fields");
  });

  it("rejects unsupported request types", () => {
    const result = aiResult({
      type: "Mystery Approval",
      fields: {}
    });

    const validation = validateIntakeSuggestion(result, request);

    expect(validation.status).toBe("Invalid");
    expect(validation.errors[0]).toContain("Unsupported request type");
  });
});

function aiResult(output: Record<string, unknown>): AiResult {
  return {
    provider: "test",
    model: "test-model",
    confidence: 0.91,
    output
  };
}
