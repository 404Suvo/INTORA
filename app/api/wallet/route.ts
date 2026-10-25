import { createWallet, getWalletAddress, getWalletBalance, X402_NETWORK, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_USDC_ADDRESS } from "@/agent/wallet";
import { NextResponse } from "next/server";

// GET /api/wallet -> the agent's wallet address, live Base Sepolia balance and network info
export async function GET() {
  const address = getWalletAddress();
  if (!address) return NextResponse.json({ address: null });

  const balance = await getWalletBalance().catch(() => "unavailable");
  return NextResponse.json({
    address,
    balance,
    network: X402_NETWORK,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    usdcAddress: BASE_SEPOLIA_USDC_ADDRESS,
  });
}

// POST /api/wallet -> initialize/create the agent's wallet
export async function POST() {
  const address = createWallet();
  return NextResponse.json({ address });
}
