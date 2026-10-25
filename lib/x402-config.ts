import fs from "fs";
import path from "path";
import {
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const X402_NETWORK = "eip155:84532" as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

/** Official Base Sepolia USDC contract from x402 docs */
export const BASE_SEPOLIA_USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const BASE_SEPOLIA_EXPLORER_BASE = "https://sepolia.basescan.org";

/** Price per research query in USD/USDC string (0.01 = $0.01 USDC = 10,000 atomic units) */
export const DEFAULT_RESEARCH_PRICE = "0.01";
export const USDC_DECIMALS = 6;

/** Strict client-side per-request spend limit in USD/USDC string */
export const MAX_PAYMENT_USD =
  process.env.X402_MAX_PAYMENT_USD || "0.05";

export const DEFAULT_BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

const AGENT_WALLET_FILE = path.join(process.cwd(), ".agent-wallet.json");

let inMemoryAgentAccount: ReturnType<typeof privateKeyToAccount> | null = null;

/**
 * Public client for Base Sepolia testnet queries
 */
export function getBaseSepoliaPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(DEFAULT_BASE_SEPOLIA_RPC),
  });
}

/**
 * Loads or safely initializes the server-side dedicated test agent wallet.
 *
 * Priority order:
 * 1. X402_BUYER_PRIVATE_KEY
 * 2. AGENT_PRIVATE_KEY
 * 3. WALLET_PRIVATE_KEY
 * 4. Persisted local dedicated test wallet in .agent-wallet.json
 *
 * NOTE: Private keys are NEVER sent to the client or returned in API responses.
 */
export function getAgentAccount() {
  const envKey =
    process.env.X402_BUYER_PRIVATE_KEY ||
    process.env.AGENT_PRIVATE_KEY ||
    process.env.WALLET_PRIVATE_KEY;

  if (envKey && envKey.trim().length > 0) {
    const trimmed = envKey.trim();
    if (trimmed.includes("_") || trimmed.length < 64) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[x402-config] Agent private key contains placeholder or invalid format. Falling back.");
      }
    } else {
      try {
        const formatted = (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
        return privateKeyToAccount(formatted);
      } catch (err: any) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[x402-config] Could not initialize account from environment private key:", err?.message);
        }
      }
    }
  }

  // Fallback 1: cached in-memory agent wallet
  if (inMemoryAgentAccount) {
    return inMemoryAgentAccount;
  }

  // Fallback 2: load local dedicated test-only agent wallet
  try {
    if (fs.existsSync(AGENT_WALLET_FILE)) {
      const content = JSON.parse(fs.readFileSync(AGENT_WALLET_FILE, "utf8"));
      if (content?.privateKey && typeof content.privateKey === "string" && !content.privateKey.includes("_")) {
        const acc = privateKeyToAccount(content.privateKey as Hex);
        inMemoryAgentAccount = acc;
        return acc;
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[x402-config] Could not read existing .agent-wallet.json:", err);
    }
  }

  // Fallback 3: Generate a dedicated test wallet in memory and attempt to persist if writable
  try {
    const newKey = generatePrivateKey();
    const acc = privateKeyToAccount(newKey);
    inMemoryAgentAccount = acc;
    try {
      fs.writeFileSync(AGENT_WALLET_FILE, JSON.stringify({ privateKey: newKey }, null, 2), "utf8");
    } catch {
      // Ignored in read-only environments (e.g. serverless)
    }
    return acc;
  } catch (err) {
    console.error("[x402-config] Failed to generate test wallet:", err);
    return null;
  }
}

/**
 * Resolves the designated seller / receiver address for x402 payments.
 */
export function getSellerAddress(): Address {
  const envSeller =
    process.env.X402_SELLER_ADDRESS ||
    process.env.PAY_TO_ADDRESS;

  if (envSeller && isAddress(envSeller)) {
    return envSeller as Address;
  }

  // Fallback to deployer address if available in env, or a deterministic fallback test address
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    try {
      const key = process.env.DEPLOYER_PRIVATE_KEY.trim();
      if (!key.includes("_") && key.length >= 64) {
        const formatted = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
        return privateKeyToAccount(formatted).address;
      }
    } catch {
      // fallback
    }
  }

  return "0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3" as Address;
}

export interface AgentWalletBalances {
  ethBalance: string;
  usdcBalance: string;
  rawUsdcBalance: string;
  hasUsdcFunds: boolean;
  status: "available" | "partial" | "unavailable";
  errorMessage?: string;
}

/**
 * Queries the agent wallet's live on-chain balances on Base Sepolia.
 * Returns string-serialized numeric values so responses are safely JSON-serializable.
 */
export async function getAgentWalletBalances(address: Address): Promise<AgentWalletBalances> {
  const client = getBaseSepoliaPublicClient();

  let ethBalance = "unknown";
  let usdcBalance = "unknown";
  let rawUsdcBalanceBigInt = 0n;
  let ethSuccess = false;
  let usdcSuccess = false;
  let lastError: string | undefined;

  try {
    const ethWei = await client.getBalance({ address });
    ethBalance = Number(formatEther(ethWei)).toFixed(4);
    ethSuccess = true;
  } catch (err: any) {
    lastError = err?.shortMessage || err?.message || "Failed to fetch ETH balance";
    if (process.env.NODE_ENV !== "production") {
      console.warn("[x402-config] Failed to fetch ETH balance from Base Sepolia RPC:", lastError);
    }
  }

  try {
    rawUsdcBalanceBigInt = await client.readContract({
      address: BASE_SEPOLIA_USDC_ADDRESS,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
        },
      ],
      functionName: "balanceOf",
      args: [address],
    });
    usdcBalance = formatUnits(rawUsdcBalanceBigInt, USDC_DECIMALS);
    usdcSuccess = true;
  } catch (err: any) {
    lastError = err?.shortMessage || err?.message || "Failed to fetch USDC balance";
    if (process.env.NODE_ENV !== "production") {
      console.warn("[x402-config] Failed to fetch USDC balance from Base Sepolia RPC:", lastError);
    }
  }

  // Needs at least 0.01 USDC (10,000 atomic units)
  const hasUsdcFunds = usdcSuccess && rawUsdcBalanceBigInt >= 10000n;

  const queryStatus: "available" | "partial" | "unavailable" =
    ethSuccess && usdcSuccess
      ? "available"
      : ethSuccess || usdcSuccess
      ? "partial"
      : "unavailable";

  return {
    ethBalance,
    usdcBalance,
    rawUsdcBalance: rawUsdcBalanceBigInt.toString(),
    hasUsdcFunds,
    status: queryStatus,
    ...(queryStatus !== "available" && lastError ? { errorMessage: lastError } : {}),
  };
}

/**
 * Safe public agent status (never returns private keys).
 */
export async function getAgentPublicStatus() {
  const account = getAgentAccount();
  if (!account) {
    return {
      configured: false,
      address: null,
      sellerAddress: getSellerAddress(),
      network: X402_NETWORK,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      usdcAddress: BASE_SEPOLIA_USDC_ADDRESS,
      facilitatorUrl: X402_FACILITATOR_URL,
      maxSpendUsd: MAX_PAYMENT_USD,
      balances: null,
    };
  }

  let balances: AgentWalletBalances;
  try {
    balances = await getAgentWalletBalances(account.address);
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[x402-config] Unexpected error querying agent wallet balances:", err);
    }
    balances = {
      ethBalance: "unknown",
      usdcBalance: "unknown",
      rawUsdcBalance: "0",
      hasUsdcFunds: false,
      status: "unavailable",
      errorMessage: err?.message || "RPC query failed",
    };
  }

  return {
    configured: true,
    address: account.address,
    sellerAddress: getSellerAddress(),
    network: X402_NETWORK,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    usdcAddress: BASE_SEPOLIA_USDC_ADDRESS,
    facilitatorUrl: X402_FACILITATOR_URL,
    maxSpendUsd: MAX_PAYMENT_USD,
    balances,
  };
}

/**
 * In-memory anti-replay and rate limiting guard for testnet demo payments.
 */
class PaymentRateLimiter {
  private paymentAttempts = new Map<string, number[]>();
  private activeLocks = new Set<string>();

  /**
   * Checks if an action is locked or rate-limited.
   */
  canAttempt(key: string, maxPerWindow = 6, windowMs = 60_000): { allowed: boolean; reason?: string } {
    if (this.activeLocks.has(key)) {
      return { allowed: false, reason: "A payment authorization is already in flight for this query." };
    }

    const now = Date.now();
    const timestamps = (this.paymentAttempts.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxPerWindow) {
      return { allowed: false, reason: "Rate limit reached. Please wait a moment before sending another payment." };
    }

    return { allowed: true };
  }

  acquireLock(key: string): boolean {
    if (this.activeLocks.has(key)) return false;
    this.activeLocks.add(key);
    const now = Date.now();
    const timestamps = (this.paymentAttempts.get(key) || []).filter((t) => now - t < 60_000);
    timestamps.push(now);
    this.paymentAttempts.set(key, timestamps);
    return true;
  }

  releaseLock(key: string) {
    this.activeLocks.delete(key);
  }
}

export const paymentLimiter = new PaymentRateLimiter();
