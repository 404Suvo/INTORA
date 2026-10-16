import { NextResponse } from "next/server";
import {
  getPlanVersionHistory,
  getPlanVersionRecord,
  updateVersionOnChainCommitment,
} from "@/lib/what-if";
import { updateOnChainStatus } from "@/lib/plan-storage";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get("intentId");
  const versionParam = searchParams.get("version");

  if (!intentId) {
    return NextResponse.json(
      { error: "Query parameter 'intentId' is required." },
      { status: 400 }
    );
  }

  if (versionParam) {
    const v = parseInt(versionParam, 10);
    const record = getPlanVersionRecord(intentId, v);
    if (!record) {
      return NextResponse.json(
        { error: `Version ${v} not found for intent ${intentId}.` },
        { status: 404 }
      );
    }
    return NextResponse.json(record);
  }

  const versions = getPlanVersionHistory(intentId);
  return NextResponse.json({
    intentId,
    versions,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { intentId, version, txHash, blockNumber, timestamp, status } = body || {};

    if (!intentId || typeof version !== "number") {
      return NextResponse.json(
        { error: "Both 'intentId' and numeric 'version' are required." },
        { status: 400 }
      );
    }

    const commitment = {
      txHash: txHash || undefined,
      blockNumber: typeof blockNumber === "number" ? blockNumber : 0,
      timestamp: typeof timestamp === "number" ? timestamp : Math.floor(Date.now() / 1000),
      status: (status || "confirmed") as "uncommitted" | "pending" | "confirmed" | "failed",
    };

    const updatedWhatIf = updateVersionOnChainCommitment(intentId, version, commitment);
    const updatedCore = updateOnChainStatus(intentId, version, commitment);

    return NextResponse.json({
      success: updatedWhatIf || updatedCore,
      intentId,
      version,
      commitment,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update version commitment status." },
      { status: 500 }
    );
  }
}
