import { NextResponse } from "next/server";
import { tools } from "@/agent/tools";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get("intentId");
  const versionParam = searchParams.get("version");

  if (!intentId) {
    return NextResponse.json({ error: "intentId query parameter required" }, { status: 400 });
  }

  const readTool = tools.find((t) => t.name === "read_intent");
  if (!readTool) {
    return NextResponse.json({ error: "read_intent tool unavailable" }, { status: 500 });
  }

  const version = versionParam ? parseInt(versionParam, 10) : undefined;
  const result = await readTool.run({ intentId, version }, { baseUrl: new URL(req.url).origin });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action, intentId, version, txHash, sender } = body;

  if (action === "prepare") {
    const prepareTool = tools.find((t) => t.name === "prepare_transaction");
    if (!prepareTool) return NextResponse.json({ error: "Tool not found" }, { status: 500 });
    const result = await prepareTool.run({ intentId, version, sender }, { baseUrl: new URL(req.url).origin });
    return NextResponse.json(result);
  }

  if (action === "verify") {
    const verifyTool = tools.find((t) => t.name === "verify_transaction");
    if (!verifyTool) return NextResponse.json({ error: "Tool not found" }, { status: 500 });
    const result = await verifyTool.run({ txHash, intentId, version }, { baseUrl: new URL(req.url).origin });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid action. Supported: prepare, verify" }, { status: 400 });
}
