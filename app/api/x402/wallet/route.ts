import { NextResponse } from "next/server";
import { getAgentPublicStatus, getAgentAccount } from "@/lib/x402-config";

// GET /api/x402/wallet -> public status of the agent wallet
export async function GET() {
  try {
    const status = await getAgentPublicStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to query agent wallet status" },
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
    return NextResponse.json({
      success: true,
      address: account.address,
      status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Wallet creation failed" },
      { status: 500 }
    );
  }
}
