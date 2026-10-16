import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/scraperapi";
import { interpretScenarioRequest, simulateShoppingPlan } from "@/lib/what-if";

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const { plan, scenarioPrompt, preference } = body || {};

    if (!plan || !Array.isArray(plan.items)) {
      return NextResponse.json(
        { success: false, error: "A valid shopping plan object with items is required." },
        { status: 400 }
      );
    }

    if (!scenarioPrompt || typeof scenarioPrompt !== "string" || !scenarioPrompt.trim()) {
      return NextResponse.json(
        { success: false, error: "A natural-language what-if scenario request is required." },
        { status: 400 }
      );
    }

    const cleanPrompt = scenarioPrompt.trim();

    // 1. Interpret scenario request
    const scenario = await interpretScenarioRequest(
      cleanPrompt,
      {
        currentBudget: plan.budget,
        currentSituation: plan.situation || plan.title,
        currentItems: plan.items,
        currentPreference: preference || plan.userPreference,
        parentPlanId: plan.id,
        parentVersion: plan.version || 1,
      },
      { signal: req.signal }
    );

    // 2. Check for ambiguity
    if (scenario.ambiguityQuestion) {
      return NextResponse.json({
        success: false,
        ambiguous: true,
        ambiguityQuestion: scenario.ambiguityQuestion,
        scenario,
      });
    }

    // 3. Check for validation errors
    if (!scenario.isValid || (scenario.validationErrors && scenario.validationErrors.length > 0)) {
      return NextResponse.json(
        {
          success: false,
          error: scenario.validationErrors?.join(" ") || "Invalid scenario parameters.",
          validationErrors: scenario.validationErrors,
          scenario,
        },
        { status: 400 }
      );
    }

    // 4. Simulate changes and recalculate shopping plan
    const simulationResult = await simulateShoppingPlan(plan, scenario, {
      userPreference: preference || plan.userPreference,
    });

    return NextResponse.json({
      success: true,
      plan: simulationResult.newPlan,
      versionRecord: simulationResult.versionRecord,
      diff: simulationResult.diff,
      summary: simulationResult.summary,
      scenario,
    });
  } catch (err: any) {
    const rawMsg = err?.message || "Failed to simulate what-if scenario.";
    const message = sanitizeErrorMessage(rawMsg);
    console.error("[What-If API] Simulation error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
