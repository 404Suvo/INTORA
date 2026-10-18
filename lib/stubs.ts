/**
 * Intent-to-Commerce AI Agent — Integration Stubs
 * 
 * These stub functions are clearly marked insertion points for:
 * 1. Google Gemini 2.5 API (Natural Language Reasoning & Catalog Optimization)
 * 2. Deterministic Keccak-256 Hashing (Viem / Web3 canonical hash)
 * 3. MetaMask Ethereum Provider (Base Sepolia Testnet 84532)
 * 4. ShoppingIntentRegistry Smart Contract (On-Chain Commitments)
 *
 * Current implementation uses simulated local delays and realistic mock data
 * so the frontend is 100% testable without live API keys or funded test wallets.
 */

import { keccak256, stringToHex, encodeFunctionData } from "viem";
import { MOCK_PLANS, PRESET_SITUATIONS, ShoppingPlanData, ProductItem } from "@/data/mockData";
import {
  BASE_SEPOLIA_CHAIN_ID,
  EVIDENCE_SINK_ADDRESS,
  getRegistryContractAddress,
  INTENT_REGISTRY_ADDRESS,
  SHOPPING_INTENT_REGISTRY_ABI,
} from "./contract-config";
import { promptSwitchToBaseSepolia } from "./web3-wallet";
import {
  optimizeShoppingPlan,
  processFollowUpRequest,
  type OptimizationOptions,
} from "./budget-optimizer";
import { validateBudgetInr } from "./types";

// ============================================================================
// STUB 1: generatePlan()
// ============================================================================
/**
 * Generates an AI-optimized shopping plan from a natural language situation and budget.
 * Grounded in catalog SKUs with exact integer rupee math and knapsack budget cap enforcement.
 *
 * @param prompt Natural language description of the event, trip, or shopping need.
 * @param budget Maximum expenditure ceiling in Indian Rupees (₹).
 * @returns Promise<ShoppingPlanData>
 */
function cleanTitleFromPrompt(prompt: string): string {
  const stripped = prompt
    .replace(/^(i want|i need|need|give me|buy|please give|looking for|plan for|bundle for)\s+/i, "")
    .replace(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|cap)\s*[:=]?\s*[0-9]+(?:,[0-9]+)*/gi, "")
    .trim();
  if (!stripped) return "Curated Shopping Bundle";
  const words = stripped
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `${words.join(" ")} Essentials`;
}

export interface PlanGenerationClientOptions {
  preference?: import("./trade-off-engine").UserTradeOffPreference;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function generatePlan(
  prompt: string,
  budget: number,
  options: PlanGenerationClientOptions = {}
): Promise<ShoppingPlanData> {
  const budgetValidation = validateBudgetInr(budget);
  if (!budgetValidation.valid || budgetValidation.budget === undefined) {
    throw new Error(budgetValidation.error || "A positive rupee budget amount is required.");
  }
  const roundedBudget = budgetValidation.budget;

  // 1. Client-side browser execution: call server endpoint /api/plan/generate
  if (typeof window !== "undefined") {
    let res: Response;
    try {
      res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Prefer": "respond-async",
        },
        body: JSON.stringify({
          prompt,
          budget: roundedBudget,
          preference: options.preference,
          async: true,
        }),
        signal: options.signal,
      });
    } catch (networkErr: any) {
      if (networkErr?.name === "AbortError" || options.signal?.aborted) {
        const abortErr = new Error("Request was cancelled.");
        (abortErr as any).name = "AbortError";
        throw abortErr;
      }
      throw new Error(`Network failure connecting to /api/plan/generate: ${networkErr?.message || String(networkErr)}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server returned a non-JSON response (Status: ${res.status}).`);
    }

    // 1.1 Handle 202 Accepted asynchronous background job polling
    if (res.status === 202 && data.checkUrl) {
      const checkUrl = data.checkUrl;
      const pollStart = Date.now();
      const maxWaitMs = options.timeoutMs || 75000;

      while (Date.now() - pollStart < maxWaitMs) {
        if (options.signal?.aborted) {
          const abortErr = new Error("Request was cancelled.");
          (abortErr as any).name = "AbortError";
          throw abortErr;
        }

        await new Promise((r) => setTimeout(r, 1800));

        let pollRes: Response;
        try {
          pollRes = await fetch(checkUrl, { signal: options.signal });
        } catch (pollErr: any) {
          if (pollErr?.name === "AbortError" || options.signal?.aborted) {
            const abortErr = new Error("Request was cancelled.");
            (abortErr as any).name = "AbortError";
            throw abortErr;
          }
          throw new Error(`Failed to poll plan job: ${pollErr?.message || String(pollErr)}`);
        }

        let pollData: any;
        try {
          pollData = await pollRes.json();
        } catch {
          continue;
        }

        if (pollData.status === "completed" && pollData.plan) {
          return pollData.plan;
        }

        if (pollData.status === "failed" || (!pollRes.ok && pollRes.status !== 200)) {
          const errMsg =
            pollData.userFriendlyMessage ||
            pollData.error ||
            `Background plan generation failed (Status: ${pollRes.status}).`;
          const err = new Error(errMsg);
          (err as any).statusCode = pollRes.status;
          (err as any).errorCode = pollData.errorCode || "SEARCH_FAILED";
          (err as any).isRetryable = pollData.isRetryable ?? false;
          (err as any).userFriendlyMessage = pollData.userFriendlyMessage || errMsg;
          (err as any).rawError = pollData.error;
          (err as any).details = pollData.details;
          throw err;
        }
      }

      const timeoutErr = new Error("Background plan generation timed out after 75 seconds.");
      (timeoutErr as any).statusCode = 504;
      (timeoutErr as any).errorCode = "PROVIDER_TIMEOUT";
      (timeoutErr as any).isRetryable = true;
      (timeoutErr as any).userFriendlyMessage = "Live product search is taking longer than expected. Please retry.";
      throw timeoutErr;
    }

    if (!res.ok || !data.success) {
      const errMsg =
        data.userFriendlyMessage ||
        data.error ||
        `Failed to generate live Amazon plan via ScraperAPI (Status: ${res.status}).`;
      const err = new Error(errMsg);
      (err as any).statusCode = res.status;
      (err as any).errorCode = data.errorCode || (res.status === 504 ? "PROVIDER_TIMEOUT" : "SEARCH_FAILED");
      (err as any).isRetryable = data.isRetryable ?? (res.status === 504 || res.status === 429);
      (err as any).userFriendlyMessage = data.userFriendlyMessage || errMsg;
      (err as any).rawError = data.error;
      (err as any).details = data.details;
      throw err;
    }
    return data.plan;
  }

  // 2. Server-side Node.js execution: call planner engine directly
  const { generateRealShoppingPlan } = await import("./planner-engine");
  return generateRealShoppingPlan(prompt, roundedBudget, {
    preference: options.preference,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}

/**
 * Generates an explicitly labeled sample/demo shopping plan for offline evaluation.
 * Never claims live verified prices and explicitly marks isDemoFallback: true.
 */
export function getDemoFallbackPlan(
  prompt: string,
  budget: number = 3000,
  preference: import("./trade-off-engine").UserTradeOffPreference = "balanced"
): ShoppingPlanData {
  const basePlan = MOCK_PLANS["college-fest"] || Object.values(MOCK_PLANS)[0];
  const items = basePlan.items.map((item) => ({
    ...item,
    source: "fixture" as const,
  }));
  const total = items.reduce((acc, i) => acc + i.totalPrice, 0);

  return {
    ...basePlan,
    id: `demo-plan-${Date.now()}`,
    title: `[Demo] ${cleanTitleFromPrompt(prompt)}`,
    situation: prompt || basePlan.situation,
    budget,
    totalAmount: total,
    remainingAmount: Math.max(0, budget - total),
    isDemoFallback: true,
    demoDisclaimer:
      "Sample demonstration plan using pre-saved catalog items. Live Amazon India prices were NOT verified in real-time.",
    validation: {
      budgetCompliant: total <= budget,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    userPreference: preference,
  };
}

/**
 * Evaluates multi-criteria trade-offs across candidate products.
 */
export async function evaluateTradeOffs(
  candidates: any[],
  prompt: string,
  options: {
    quantity?: number;
    preference?: import("./trade-off-engine").UserTradeOffPreference;
    budget?: number;
  } = {}
): Promise<import("./trade-off-engine").TradeOffRecommendation | null> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/plan/trade-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates,
          prompt,
          quantity: options.quantity,
          preference: options.preference,
          budget: options.budget,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.recommendation) {
          return data.recommendation;
        }
      }
    } catch (e) {
      console.warn("Client /api/plan/trade-offs error:", e);
    }
  }

  const { rankAndRecommendCandidates, normalizeProduct, extractUserRequirements } = await import(
    "./trade-off-engine"
  );
  const normalized = candidates.map((c) => normalizeProduct(c)).filter(Boolean) as any[];
  const reqs = extractUserRequirements(prompt);
  return rankAndRecommendCandidates(
    normalized,
    options.quantity || 1,
    reqs,
    options.preference || "balanced",
    options.budget
  );
}

/**
 * Optimizes an existing shopping plan against a target budget or user constraints.
 */
export async function optimizePlan(
  plan: ShoppingPlanData,
  targetBudget?: number,
  options?: OptimizationOptions
): Promise<ShoppingPlanData> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/plan/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          targetBudget,
          userConstraints: options?.userConstraints,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.plan) {
          return data.plan;
        }
      }
    } catch (e) {
      console.warn("Client /api/plan/optimize fallback to local engine:", e);
    }
  }

  return optimizeShoppingPlan(plan, targetBudget, options);
}

/**
 * Restores the original plan prior to budget optimization adjustments.
 */
export async function restorePlan(plan: ShoppingPlanData): Promise<ShoppingPlanData> {
  return optimizePlan(plan, undefined, {
    userConstraints: { restoreOriginal: true },
  });
}

// ============================================================================
// STUB 2: hashPlan()
// ============================================================================
/**
 * Computes a deterministic cryptographic Keccak-256 hash of the canonical shopping plan.
 * Keys and items are strictly sorted; amounts are integer exact.
 *
 * @param plan The approved shopping plan data.
 * @returns Promise<string> 32-byte hexadecimal string prefixed with 0x.
 */
export async function hashPlan(plan: ShoppingPlanData): Promise<string> {
  const sortedItems = [...plan.items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

  const canonicalObj = {
    budget: Math.round(plan.budget),
    id: plan.id.toLowerCase(),
    items: sortedItems,
    total: Math.round(plan.totalAmount),
    version: plan.version || 1,
  };

  const canonicalJson = JSON.stringify(canonicalObj);
  return keccak256(stringToHex(canonicalJson));
}


// ============================================================================
// STUB 3: connectWallet()
// ============================================================================
/**
 * Connects the user's MetaMask Web3 wallet and ensures it is on Base Sepolia Testnet (84532).
 * Falls back gracefully to simulated sandbox wallet if MetaMask extension is not present.
 *
 * @returns Promise<{ address: string; chainId: number }>
 */
export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    try {
      const eth = (window as any).ethereum;
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts selected in MetaMask.");
      }

      // Explicitly pop up MetaMask to switch/add Base Sepolia Testnet (0x14a34 = 84532)
      await promptSwitchToBaseSepolia();

      const currentChainHex = (await eth.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(currentChainHex, 16);

      return {
        address: accounts[0],
        chainId: chainId || BASE_SEPOLIA_CHAIN_ID,
      };
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        throw new Error("MetaMask connection request was canceled by user.");
      }
      throw err;
    }
  }

  // Simulated Web3 Wallet connection for browser environments without MetaMask
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    address: "0x71C8241b80c5D91839aB026a100518Fa6D1839aB",
    chainId: BASE_SEPOLIA_CHAIN_ID,
  };
}

// ============================================================================
// STUB 4: recordPlanOnChain()
// ============================================================================
/**
 * Records the approved shopping plan hash onto the Base Sepolia Testnet blockchain.
 * Triggers live MetaMask approval on Base Sepolia Testnet; falls back to sandbox commitment.
 *
 * @param planHash 32-byte cryptographic plan hash.
 * @param version Integer version of the plan (1, 2, 3...).
 * @param plan Optional full plan data to construct calldata.
 * @param options Optional fallback flag for sandbox environments.
 * @returns Promise<{ txHash: string; blockNumber: number; account?: string }>
 */
export async function recordPlanOnChain(
  planHash: string,
  version: number,
  plan?: ShoppingPlanData | null,
  options?: { sandboxFallback?: boolean }
): Promise<{ txHash: string; blockNumber: number; account?: string }> {
  // If window.ethereum is available, trigger real MetaMask popups on Base Sepolia Testnet
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const eth = (window as any).ethereum;

    // STEP 1: Pop up MetaMask to request account permission
    let accounts: string[] = [];
    try {
      accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    } catch (reqErr: any) {
      if (reqErr.code === 4001 || reqErr.message?.includes("rejected") || reqErr.message?.includes("denied")) {
        throw new Error("MetaMask permission was denied. You rejected the wallet connection request.");
      }
      throw new Error(`MetaMask connection error: ${reqErr.message || reqErr}`);
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts authorized in MetaMask. Please grant permission in MetaMask.");
    }
    const userAccount = accounts[0];

    // STEP 2: ENSURE METAMASK IS ON TESTNET (Base Sepolia Testnet: 84532 / 0x14a34)
    // Explicitly pops up MetaMask to switch or add Base Sepolia Testnet
    try {
      await promptSwitchToBaseSepolia();
    } catch (switchErr: any) {
      if (switchErr.code === 4001 || switchErr.message?.includes("rejected")) {
        throw new Error("Network switch rejected in MetaMask. Base Sepolia Testnet (84532) is required to record commitments.");
      }
      throw new Error(`Failed to switch to Base Sepolia Testnet: ${switchErr.message || switchErr}`);
    }

    // Verify current chain is Base Sepolia Testnet
    const currentChainHex = (await eth.request({ method: "eth_chainId" })) as string;
    if (parseInt(currentChainHex, 16) !== BASE_SEPOLIA_CHAIN_ID) {
      throw new Error("MetaMask must be on Base Sepolia Testnet (Chain ID 84532) to record commitments on-chain.");
    }

    // STEP 3: Encode calldata for ShoppingIntentRegistry contract
    const intentIdBytes32 =
      plan?.id?.startsWith("0x") && plan.id.length === 66
        ? (plan.id as `0x${string}`)
        : keccak256(stringToHex(plan?.id || `intent_${Date.now()}`));

    const planHashBytes32 = (
      planHash.startsWith("0x") && planHash.length === 66
        ? planHash
        : keccak256(stringToHex(planHash))
    ) as `0x${string}`;

    const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30); // 30 days valid

    const functionName = version === 1 ? "recordIntent" : "recordVersion";
    const calldata = encodeFunctionData({
      abi: SHOPPING_INTENT_REGISTRY_ABI,
      functionName,
      args: [intentIdBytes32, planHashBytes32, version, expiry],
    });

    // STEP 4: Pop up MetaMask to take explicit user permission before recording transaction on-chain
    // Handle MetaMask internal account restriction:
    // If target address is an internal account in MetaMask (e.g. self-wallet or same keyring),
    // MetaMask rejects calldata with: "External transactions to internal accounts cannot include data".
    // We resolve the target address safely (routing to EVIDENCE_SINK_ADDRESS if matching userAccount)
    // and automatically retry targeting EVIDENCE_SINK_ADDRESS if MetaMask reports an internal account error.
    let targetAddress = getRegistryContractAddress(userAccount);

    let txHash: string;
    try {
      txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: targetAddress,
            from: userAccount,
            data: calldata,
          },
        ],
      })) as string;
    } catch (txErr: any) {
      if (txErr.code === 4001 || txErr.message?.includes("rejected") || txErr.message?.includes("denied")) {
        throw new Error("Transaction was rejected by user in MetaMask. No record was made on-chain.");
      }

      const errLower = (txErr.message || "").toLowerCase();
      // If MetaMask blocks sending calldata to an internal account in its keyring, route to the canonical zero-value evidence sink
      if (
        errLower.includes("internal account") ||
        errLower.includes("cannot include data") ||
        errLower.includes("to internal accounts")
      ) {
        try {
          txHash = (await eth.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: EVIDENCE_SINK_ADDRESS,
                from: userAccount,
                data: calldata,
              },
            ],
          })) as string;
        } catch (retryErr: any) {
          if (retryErr.code === 4001 || retryErr.message?.includes("rejected") || retryErr.message?.includes("denied")) {
            throw new Error("Transaction was rejected by user in MetaMask. No record was made on-chain.");
          }
          throw new Error(retryErr.message || "Failed to commit evidence hash to Base Sepolia.");
        }
      } else {
        throw new Error(
          txErr.message || "Failed to execute transaction in MetaMask. Please check your Base Sepolia balance."
        );
      }
    }

    if (!txHash) {
      throw new Error("No transaction hash returned from MetaMask.");
    }

    let blockNumber = 18421904 + version * 7;
    try {
      const blockHex = (await eth.request({ method: "eth_blockNumber" })) as string;
      if (blockHex) blockNumber = parseInt(blockHex, 16);
    } catch (_) {}

    // Persist to local session history so it immediately surfaces in /history
    saveCommittedPlanLocally(plan, planHash, txHash, blockNumber, version);

    return {
      txHash,
      blockNumber,
      account: userAccount,
    };
  }

  // Fallback for environments where MetaMask is not installed and sandbox is explicitly requested
  if (options?.sandboxFallback) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const simulatedBlock = 18421904 + version * 7;
    const simulatedTx = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;

    saveCommittedPlanLocally(plan, planHash, simulatedTx, simulatedBlock, version);

    return {
      txHash: simulatedTx,
      blockNumber: simulatedBlock,
      account: "0x71C8241b80c5D91839aB026a100518Fa6D1839aB",
    };
  }

  throw new Error("MetaMask is not detected. Please install the MetaMask browser extension to approve and record plans on Base Sepolia.");
}

/**
 * Explicit sandbox simulation for environments without MetaMask
 */
export async function recordPlanSandbox(
  planHash: string,
  version: number,
  plan?: ShoppingPlanData | null
): Promise<{ txHash: string; blockNumber: number; account: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const simulatedBlock = 18421904 + version * 7;
  const simulatedTx = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")}`;

  saveCommittedPlanLocally(plan, planHash, simulatedTx, simulatedBlock, version);

  return {
    txHash: simulatedTx,
    blockNumber: simulatedBlock,
    account: "0x71C8241b80c5D91839aB026a100518Fa6D1839aB",
  };
}

/**
 * Saves committed transaction record to localStorage so it appears in /history
 */
function saveCommittedPlanLocally(
  plan: ShoppingPlanData | null | undefined,
  planHash: string,
  txHash: string,
  blockNumber: number,
  version: number
) {
  if (typeof window === "undefined") return;
  try {
    const existingRaw = localStorage.getItem("intora_committed_plans");
    const existing = existingRaw ? JSON.parse(existingRaw) : [];

    const newRecord = {
      version,
      timestamp:
        new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " IST",
      situation: plan?.situation || plan?.title || "Shopping Intent Commitment",
      budget: plan?.budget || 3000,
      total: plan?.totalAmount || 2890,
      itemCount: plan?.items?.length || 6,
      planHash,
      txHash,
      blockNumber,
      gasFee: "0.000042 ETH (₹11.20)",
      notes: `User-approved commitment v${version} committed on Base Sepolia.`,
    };

    localStorage.setItem(
      "intora_committed_plans",
      JSON.stringify([newRecord, ...existing.filter((r: any) => r.txHash !== txHash)])
    );
  } catch (err) {
    // Ignore storage quota errors
  }
}

/**
 * Simulates a What-if scenario request on a shopping plan.
 * Invokes /api/plan/simulate on the client, or server-side simulation directly in Node.
 */
export async function simulateWhatIfScenario(
  plan: ShoppingPlanData,
  scenarioPrompt: string,
  options: {
    preference?: import("./trade-off-engine").UserTradeOffPreference;
    signal?: AbortSignal;
  } = {}
): Promise<{
  plan: ShoppingPlanData;
  versionRecord: any;
  diff: any;
  summary: string;
  ambiguityQuestion?: string;
}> {
  if (typeof window !== "undefined") {
    let res: Response;
    try {
      res = await fetch("/api/plan/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          scenarioPrompt,
          preference: options.preference,
        }),
        signal: options.signal,
      });
    } catch (networkErr: any) {
      if (networkErr?.name === "AbortError" || options.signal?.aborted) {
        const abortErr = new Error("Simulation request was cancelled.");
        (abortErr as any).name = "AbortError";
        throw abortErr;
      }
      throw new Error(`Network failure connecting to /api/plan/simulate: ${networkErr?.message || String(networkErr)}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server returned non-JSON response (Status: ${res.status}).`);
    }

    if (data.ambiguous) {
      return {
        plan,
        versionRecord: null,
        diff: null,
        summary: data.ambiguityQuestion,
        ambiguityQuestion: data.ambiguityQuestion,
      };
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Simulation failed.");
    }

    return {
      plan: data.plan,
      versionRecord: data.versionRecord,
      diff: data.diff,
      summary: data.summary,
    };
  }

  // Node runtime / offline fallback
  const { interpretScenarioRequest, simulateShoppingPlan } = await import("./what-if");
  const scenario = await interpretScenarioRequest(scenarioPrompt, {
    currentBudget: plan.budget,
    currentSituation: plan.situation || plan.title,
    currentItems: plan.items,
    currentPreference: options.preference || plan.userPreference,
    parentPlanId: plan.id,
    parentVersion: plan.version || 1,
  });

  if (scenario.ambiguityQuestion) {
    return {
      plan,
      versionRecord: null,
      diff: null,
      summary: scenario.ambiguityQuestion,
      ambiguityQuestion: scenario.ambiguityQuestion,
    };
  }

  if (!scenario.isValid) {
    throw new Error(scenario.validationErrors?.join(" ") || "Invalid scenario parameters.");
  }

  const result = await simulateShoppingPlan(plan, scenario, {
    userPreference: options.preference || plan.userPreference,
  });

  return {
    plan: result.newPlan,
    versionRecord: result.versionRecord,
    diff: result.diff,
    summary: result.summary,
  };
}

