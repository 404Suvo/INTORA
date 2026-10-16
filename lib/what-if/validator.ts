import { MIN_BUDGET_INR, MAX_BUDGET_INR } from "@/lib/types";
import { ValidatedScenario } from "./types";

export interface ValidationOutput {
  isValid: boolean;
  errors: string[];
  ambiguityQuestion?: string;
  sanitizedBudget?: number;
  sanitizedPeopleCount?: number;
  sanitizedDurationDays?: number;
}

/**
 * Validates a structured scenario representation against Intora business constraints.
 * 
 * Core Rules:
 * 1. Enforces min ₹100 and max ₹2,00,000 budget limits.
 * 2. Rejects negative or nonsensical values (people <= 0, days <= 0, negative budget).
 * 3. Never silently increases the user's budget.
 * 4. Asks concise follow-up question when critical parameters are ambiguous.
 */
export function validateScenario(
  scenario: Partial<ValidatedScenario>,
  currentContext: {
    currentBudget: number;
    currentPeopleCount?: number;
    currentDurationDays?: number;
  }
): ValidationOutput {
  const errors: string[] = [];
  let ambiguityQuestion: string | undefined = scenario.ambiguityQuestion;

  // 1. Ambiguity Detection
  if (ambiguityQuestion) {
    return {
      isValid: false,
      errors: [],
      ambiguityQuestion,
    };
  }

  // 2. Budget Validation
  let finalBudget = scenario.budget;
  if (scenario.budgetDelta !== undefined && scenario.budgetDelta !== 0) {
    finalBudget = (scenario.budget ?? currentContext.currentBudget) + scenario.budgetDelta;
  }

  if (finalBudget !== undefined) {
    if (typeof finalBudget !== "number" || isNaN(finalBudget)) {
      errors.push("Budget must be a valid number.");
    } else if (finalBudget <= 0) {
      errors.push("Budget must be a positive rupee amount.");
    } else if (finalBudget < MIN_BUDGET_INR) {
      errors.push(`Budget must be at least ₹${MIN_BUDGET_INR.toLocaleString("en-IN")}.`);
    } else if (finalBudget > MAX_BUDGET_INR) {
      errors.push(
        `Budget cannot exceed ₹${MAX_BUDGET_INR.toLocaleString("en-IN")} (2 lakh INR).`
      );
    }
  }

  // 3. People Count Validation
  let finalPeople = scenario.peopleCount;
  if (scenario.peopleDelta !== undefined && scenario.peopleDelta !== 0) {
    finalPeople = (scenario.peopleCount ?? currentContext.currentPeopleCount ?? 1) + scenario.peopleDelta;
  }

  if (finalPeople !== undefined) {
    if (typeof finalPeople !== "number" || isNaN(finalPeople)) {
      errors.push("Number of people must be a valid number.");
    } else if (finalPeople <= 0) {
      errors.push("Number of people must be at least 1.");
    } else if (finalPeople > 50) {
      errors.push("Maximum group size supported in simulator is 50 people.");
    }
  }

  // 4. Duration Validation
  let finalDuration = scenario.durationDays;
  if (scenario.durationDelta !== undefined && scenario.durationDelta !== 0) {
    finalDuration = (scenario.durationDays ?? currentContext.currentDurationDays ?? 3) + scenario.durationDelta;
  }

  if (finalDuration !== undefined) {
    if (typeof finalDuration !== "number" || isNaN(finalDuration)) {
      errors.push("Duration in days must be a valid number.");
    } else if (finalDuration <= 0) {
      errors.push("Duration must be at least 1 day.");
    } else if (finalDuration > 60) {
      errors.push("Duration cannot exceed 60 days.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    ambiguityQuestion,
    sanitizedBudget: finalBudget !== undefined && errors.length === 0 ? Math.round(finalBudget) : undefined,
    sanitizedPeopleCount: finalPeople !== undefined && errors.length === 0 ? Math.round(finalPeople) : undefined,
    sanitizedDurationDays: finalDuration !== undefined && errors.length === 0 ? Math.round(finalDuration) : undefined,
  };
}
