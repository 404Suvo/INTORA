import { NextResponse } from "next/server";
import { computePlanHash } from "@/lib/plan-hash";
import {
  getAllPlanVersions,
  getLatestPlanRecord,
  getPlanRecord,
  listAllStoredIntents,
  savePlanRecord,
} from "@/lib/plan-storage";
import { validatePlan } from "@/lib/plan-validator";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get("intentId");
  const versionParam = searchParams.get("version");

  if (!intentId) {
    const list = listAllStoredIntents();
    return NextResponse.json({ intents: list });
  }

  if (versionParam) {
    const version = parseInt(versionParam, 10);
    const plan = getPlanRecord(intentId, version);
    if (!plan) {
      return NextResponse.json({ error: "Plan version not found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  }

  const allVersions = getAllPlanVersions(intentId);
  const latest = getLatestPlanRecord(intentId);
  return NextResponse.json({
    intentId,
    latest,
    versions: allVersions,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = validatePlan(body);

    if (!validation.valid || !validation.validatedPlan) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
          priceMismatches: validation.priceMismatches,
        },
        { status: 400 }
      );
    }

    const { canonicalString, planHash } = computePlanHash(validation.validatedPlan);
    const stored = savePlanRecord(validation.validatedPlan, canonicalString, planHash);

    return NextResponse.json({
      success: true,
      stored,
      priceMismatches: validation.priceMismatches,
      warnings: validation.warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
