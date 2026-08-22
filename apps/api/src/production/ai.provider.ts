import type { AiRequest, AiResult } from "./domain.js";

export interface AiProvider {
  providerName: string;
  model: string;
  complete(request: AiRequest): Promise<AiResult>;
}

export type AiValidationResult = {
  status: "Valid" | "NeedsReview" | "Invalid";
  errors: string[];
  normalizedOutput: Record<string, unknown>;
};

export interface AiSuggestionRepository {
  saveSuggestion(input: {
    request: AiRequest;
    result: AiResult;
    validation: AiValidationResult;
    advisoryOnly: boolean;
    requiresRuleValidation: boolean;
  }): Promise<string>;
}

export class AiService {
  constructor(
    private readonly provider: AiProvider,
    private readonly validator: (result: AiResult, request: AiRequest) => AiValidationResult,
    private readonly repository?: AiSuggestionRepository
  ) {}

  async suggest(request: AiRequest) {
    const result = await this.provider.complete(request);
    const validation = this.validator(result, request);
    const advisory = {
      ...result,
      output: validation.normalizedOutput,
      advisoryOnly: true,
      requiresRuleValidation: true,
      validation
    };
    const suggestionId = await this.repository?.saveSuggestion({
      request,
      result: { ...result, output: validation.normalizedOutput },
      validation,
      advisoryOnly: true,
      requiresRuleValidation: true
    });
    return { ...advisory, suggestionId };
  }
}
