import { NextRequest, NextResponse } from "next/server";

// Sample legacy endpoint retained for route compatibility
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "Kolkata";
  return NextResponse.json({
    city,
    temperatureC: 28,
    condition: "Sunny",
    notice: "For protected digital services, use /api/research/product via official x402 protocol.",
  });
}
