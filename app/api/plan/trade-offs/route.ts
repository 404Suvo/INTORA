import { NextResponse } from "next/server";
import {
  extractUserRequirements,
  normalizeProduct,
  rankAndRecommendCandidates,
  type NormalizedProduct,
  type RawProductInput,
  type UserTradeOffPreference,
} from "@/lib/trade-off-engine";

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

    const {
      candidates,
      prompt,
      situation,
      quantity = 1,
      preference = "balanced",
      budget,
    } = body || {};

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: "An array of candidate products is required." },
        { status: 400 }
      );
    }

    const situationText = String(prompt || situation || "");
    const userRequirements = extractUserRequirements(situationText);

    // Normalize candidates
    const normalized: NormalizedProduct[] = candidates
      .map((c: RawProductInput) => normalizeProduct(c))
      .filter((p): p is NormalizedProduct => p !== null);

    if (normalized.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "None of the provided candidates have valid names, in-stock availability, or INR prices.",
        },
        { status: 422 }
      );
    }

    const validPref: UserTradeOffPreference =
      preference === "lowest_cost" || preference === "quality" || preference === "features"
        ? preference
        : "balanced";

    const recommendation = rankAndRecommendCandidates(
      normalized,
      Math.max(1, Math.round(quantity)),
      userRequirements,
      validPref,
      typeof budget === "number" ? budget : undefined
    );

    if (!recommendation) {
      return NextResponse.json(
        { success: false, error: "Could not evaluate trade-offs for the given candidates." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      preference: validPref,
      requirements: userRequirements,
      recommendation,
      disclaimer:
        "Total-cost and trade-off comparison evaluated using deterministic application logic and verified product data.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal trade-off evaluation error." },
      { status: 500 }
    );
  }
}
