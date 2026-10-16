import { NextResponse } from "next/server";
import {
  optimizeShoppingPlan,
  processFollowUpRequest,
  OptimizationUserConstraints,
} from "@/lib/budget-optimizer";
import { ShoppingPlanData } from "@/data/mockData";
import { sanitizeErrorMessage } from "@/lib/scraperapi";
import { validateBudgetInr } from "@/lib/types";

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body.",
        },
        { status: 400 }
      );
    }

    const { plan, targetBudget, userConstraints, followUpPrompt } = body || {};

    if (!plan || !Array.isArray(plan.items)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid 'plan' object with items is required for budget optimization.",
        },
        { status: 400 }
      );
    }

    if (plan.budget !== undefined && plan.budget !== null) {
      const planBudgetValidation = validateBudgetInr(plan.budget);
      if (!planBudgetValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: planBudgetValidation.error || "Plan budget is invalid.",
          },
          { status: 400 }
        );
      }
    }

    if (targetBudget !== undefined && targetBudget !== null) {
      const budgetValidation = validateBudgetInr(targetBudget);
      if (!budgetValidation.valid || budgetValidation.budget === undefined) {
        return NextResponse.json(
          {
            success: false,
            error: budgetValidation.error || "A positive rupee target budget amount is required.",
          },
          { status: 400 }
        );
      }
    }

    let optimizedPlan: ShoppingPlanData;

    if (followUpPrompt && typeof followUpPrompt === "string" && followUpPrompt.trim()) {
      optimizedPlan = processFollowUpRequest(plan, followUpPrompt.trim(), {
        userConstraints,
      });
    } else {
      optimizedPlan = optimizeShoppingPlan(plan, targetBudget, {
        userConstraints,
      });
    }

    return NextResponse.json({
      success: true,
      plan: optimizedPlan,
      changes: optimizedPlan.changes || [],
      optimizationResult: optimizedPlan.optimizationResult,
      feasible: optimizedPlan.feasible,
      summary: optimizedPlan.optimizationSummary,
    });
  } catch (err: any) {
    const rawMessage = err?.message || "Failed to optimize shopping plan.";
    const message = sanitizeErrorMessage(rawMessage);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
