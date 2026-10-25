import { NextRequest, NextResponse } from "next/server";
import { executePaidResearch } from "@/lib/x402-buyer";

// POST /api/x402/research -> Triggers real x402 payment flow for deep product research
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query : "essential supplies";
    const category = typeof body?.category === "string" ? body.category : undefined;
    const maxSpendUsd = typeof body?.maxSpendUsd === "string" ? body.maxSpendUsd : undefined;

    // Build the base URL from the incoming request headers to work seamlessly on localhost and Vercel
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    const telemetry = await executePaidResearch({
      query,
      category,
      maxSpendUsd,
      baseUrl,
    });

    return NextResponse.json(telemetry);
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "Failed",
        errorMessage: err?.message || "Unexpected error during x402 payment execution",
        isRetryable: true,
      },
      { status: 500 }
    );
  }
}
