import { NextResponse } from "next/server";
import { getAgentPublicStatus, getAgentAccount } from "@/lib/x402-config";

/**
 * Safely serializes objects containing BigInt values without throwing TypeError.
 */
function safeJsonResponse(data: any, init?: ResponseInit) {
  const sanitized = JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
  return NextResponse.json(sanitized, init);
}

// GET /api/x402/wallet -> public status of the agent wallet
export async function GET() {
  try {
    const status = await getAgentPublicStatus();
    return safeJsonResponse(status);
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/x402/wallet] GET failed:", err);
    }
    return NextResponse.json(
      { error: "Failed to query agent wallet status" },
      { status: 500 }
    );
  }
}

// POST /api/x402/wallet -> ensures a dedicated test agent wallet is initialized
export async function POST() {
  try {
    const account = getAgentAccount();
    if (!account) {
      return NextResponse.json(
        { error: "Failed to initialize agent wallet" },
        { status: 500 }
      );
    }
    const status = await getAgentPublicStatus();
    return safeJsonResponse({
      success: true,
      address: account.address,
      status,
    });
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/x402/wallet] POST failed:", err);
    }
    return NextResponse.json(
      { error: "Wallet initialization failed" },
      { status: 500 }
    );
  }
}
