/**
 * THE AGENT'S WALLET (Official x402 Protocol Integration)
 *
 * Dedicated server-side test agent wallet for paying protected resources
 * via the official x402 payment protocol on Base Sepolia (eip155:84532).
 */
import {
  getAgentAccount,
  getAgentWalletBalances,
  getSellerAddress,
  X402_NETWORK,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
} from "@/lib/x402-config";
import { executePaidResearch, type SettlementTelemetry } from "@/lib/x402-buyer";
import { generatePrivateKey } from "viem/accounts";
import fs from "fs";
import path from "path";

const AGENT_WALLET_FILE = path.join(process.cwd(), ".agent-wallet.json");

/** The dedicated agent wallet address or null if none was created yet */
export function getWalletAddress() {
  return getAgentAccount()?.address ?? null;
}

/** Queries live on-chain balances on Base Sepolia */
export async function getWalletBalance() {
  const account = getAgentAccount();
  if (!account) return "0.00 USDC (0.0000 ETH)";
  const b = await getAgentWalletBalances(account.address);
  return `${b.usdcBalance} USDC (${b.ethBalance} ETH)`;
}

/** Initializes or ensures the dedicated test agent wallet exists */
export function createWallet() {
  const existing = getAgentAccount();
  if (existing) return existing.address;

  const newKey = generatePrivateKey();
  fs.writeFileSync(AGENT_WALLET_FILE, JSON.stringify({ privateKey: newKey }, null, 2), "utf8");
  return getAgentAccount()?.address ?? null;
}

/**
 * Executes a paid fetch using the official x402 protocol flow.
 */
export async function payAndFetch(url: string, query = "product research"): Promise<{
  data: any;
  payment: SettlementTelemetry;
}> {
  const telemetry = await executePaidResearch({
    targetUrl: url,
    query,
  });

  return {
    data: telemetry.researchData || null,
    payment: telemetry,
  };
}

export {
  X402_NETWORK,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  getSellerAddress,
};
