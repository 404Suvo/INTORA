import { NextResponse } from "next/server";
import {
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  getRegistryContractAddress,
} from "@/lib/contract-config";
import { isScraperApiConfigured } from "@/lib/scraperapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasGeminiApiKey = Boolean(process.env.GEMINI_API_KEY);
  const rpcUrl = process.env.BASE_SEPOLIA_RPC || DEFAULT_BASE_SEPOLIA_RPC;
  const contractAddress = getRegistryContractAddress();

  let rpcReachable = false;
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      rpcReachable = data?.result === "0x14a34"; // 84532 in hex
    }
  } catch {
    rpcReachable = false;
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      gemini: {
        configured: hasGeminiApiKey,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      },
      scraperapi: {
        configured: isScraperApiConfigured(),
        status: isScraperApiConfigured() ? "configured" : "missing_key",
        endpoint: "https://api.scraperapi.com",
      },
      blockchain: {
        network: "Base Sepolia",
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress,
        rpcReachable,
      },
    },
  });
}
