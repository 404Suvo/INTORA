/**
 * SERVER-SIDE CONTROLLED TOOLS FOR GEMINI AGENT
 *
 * Implements the 8 controlled tools required by Intent-to-Commerce:
 * 1. analyze_situation
 * 2. search_products
 * 3. optimize_bundle
 * 4. verify_plan
 * 5. prepare_intent
 * 6. read_intent
 * 7. prepare_transaction (calldata preparation only, never signs or sends)
 * 8. verify_transaction
 */

import {
  createPublicClient,
  encodeFunctionData,
  http,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  PRODUCT_CATALOG,
  formatInr,
  getProductById,
  searchCatalog,
} from "../lib/catalog";
import { canonicalizePlan } from "../lib/canonicalize";
import {
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  SHOPPING_INTENT_REGISTRY_ABI,
  getRegistryContractAddress,
} from "../lib/contract-config";
import { computePlanDiff } from "../lib/diff";
import { generateIntentId, generateSalt, isSaltingEnabled } from "../lib/intent-id";
import { computePlanHash, hashCanonicalString } from "../lib/plan-hash";
import {
  getAllPlanVersions,
  getLatestPlanRecord,
  getPlanRecord,
  savePlanRecord,
  updateOnChainStatus,
} from "../lib/plan-storage";
import { validatePlan } from "../lib/plan-validator";
import { CURRENCY, ShoppingPlan, ShoppingPlanItem } from "../lib/types";

export type Tool = {
  name: string;
  description: string;
  parameters: object;
  run: (args: any, ctx: { baseUrl: string }) => Promise<unknown>;
};

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC || DEFAULT_BASE_SEPOLIA_RPC),
});

/**
 * Parses user text to extract monetary amounts and convert to integer paise.
 */
function extractBudgetMinorFromText(text: string): number | null {
  // Matches "Rs. 3000", "Rs 3,000", "₹3000", "3000 INR", "3000 rupees", "budget of 3000"
  const regex = /(?:rs\.?|₹|inr|rupees|budget(?:\s+is|\s+of)?)\s*[:=]?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i;
  const match = text.match(regex);
  if (match) {
    const rawNumber = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(rawNumber) && rawNumber >= 0) {
      return Math.round(rawNumber * 100); // convert rupees to integer paise
    }
  }

  // Fallback: search for standalone numbers like "under 2000" or "2000"
  const underMatch = /(?:under|below|max|maximum|cap)\s*[:=]?\s*([0-9]+(?:,[0-9]+)*)/i.exec(text);
  if (underMatch) {
    const rawNumber = parseFloat(underMatch[1].replace(/,/g, ""));
    if (!isNaN(rawNumber) && rawNumber >= 0) {
      return Math.round(rawNumber * 100);
    }
  }

  return null;
}

export const tools: Tool[] = [
  // ─── 1. analyze_situation ───
  {
    name: "analyze_situation",
    description:
      "Analyze the user's natural language situation and extract budget, duration, required categories, preferences, and constraints.",
    parameters: {
      type: "object",
      properties: {
        situation: {
          type: "string",
          description: "The full user prompt describing the shopping situation.",
        },
        explicitBudgetRupees: {
          type: "number",
          description: "Explicit budget in rupees if stated by the user.",
        },
      },
      required: ["situation"],
    },
    run: async ({ situation, explicitBudgetRupees }) => {
      let budgetMinor = explicitBudgetRupees ? Math.round(explicitBudgetRupees * 100) : null;
      if (budgetMinor === null) {
        budgetMinor = extractBudgetMinorFromText(situation);
      }

      const sitLower = situation.toLowerCase();
      const requiredCategories: string[] = [];
      if (sitLower.includes("college") || sitLower.includes("student") || sitLower.includes("study")) {
        requiredCategories.push("stationery", "supplies");
      }
      if (sitLower.includes("activit") || sitLower.includes("trip") || sitLower.includes("event") || sitLower.includes("travel")) {
        requiredCategories.push("snacks", "supplies", "hygiene");
      }
      if (sitLower.includes("tech") || sitLower.includes("device") || sitLower.includes("phone") || sitLower.includes("charge")) {
        requiredCategories.push("electronics");
      }

      // Check duration
      const wordToNum: Record<string, string> = {
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
      };
      const durationMatch = /(\d+|one|two|three|four|five|six|seven)\s*(days|day|weeks|week)/i.exec(situation);
      let timeConstraints = "unspecified";
      if (durationMatch) {
        const rawCount = durationMatch[1].toLowerCase();
        const unit = durationMatch[2].toLowerCase();
        const count = wordToNum[rawCount] || rawCount;
        timeConstraints = `${count} ${unit}`;
      }

      return {
        situation,
        currency: CURRENCY,
        budgetMinor,
        budgetDisplay: budgetMinor ? formatInr(budgetMinor) : "Not specified",
        timeConstraints,
        requiredCategories: Array.from(new Set(requiredCategories)),
        preferences: "Essential items with high utility within stated budget",
      };
    },
  },

  // ─── 2. search_products ───
  {
    name: "search_products",
    description:
      "Search the authoritative product catalog. Returns real inventory records only. Never hallucinate items.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword to search for in catalog (e.g. notebook, pen, bottle)." },
        category: {
          type: "string",
          description: "Optional category filter: stationery, supplies, electronics, snacks, hygiene.",
        },
      },
      required: ["query"],
    },
    run: async ({ query, category }) => {
      const results = searchCatalog(query, category);
      return {
        count: results.length,
        items: results.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          priceMinor: r.priceMinor,
          priceDisplay: formatInr(r.priceMinor),
          inStock: r.inStock,
          availableStock: r.availableStock,
          description: r.description,
        })),
      };
    },
  },

  // ─── 3. optimize_bundle ───
  {
    name: "optimize_bundle",
    description:
      "Select and prioritize items from the catalog to form a cohesive bundle within the specified budget.",
    parameters: {
      type: "object",
      properties: {
        budgetMinor: {
          type: "number",
          description: "Budget cap in minor units (paise). E.g. 300000 for ₹3,000.",
        },
        candidateProductIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional preferred product IDs to prioritize.",
        },
        situationContext: {
          type: "string",
          description: "Context to guide item selection, e.g. college activities, essentials.",
        },
      },
      required: ["budgetMinor"],
    },
    run: async ({ budgetMinor, candidateProductIds, situationContext }) => {
      let candidatePool = PRODUCT_CATALOG.filter((p) => p.inStock && p.availableStock > 0);

      // Prioritize candidateProductIds if passed
      if (Array.isArray(candidateProductIds) && candidateProductIds.length > 0) {
        const preferred = candidatePool.filter((p) => candidateProductIds.includes(p.id));
        const others = candidatePool.filter((p) => !candidateProductIds.includes(p.id));
        candidatePool = [...preferred, ...others];
      }

      // Priority ordering for student/college bundle
      const priorityOrder = [
        "college-notebook-pack", // ₹250
        "gel-pen-set", // ₹120
        "stainless-water-bottle", // ₹450
        "energy-bar-box", // ₹300
        "mini-first-aid-kit", // ₹220
        "highlighter-pack", // ₹160
        "hand-sanitizer-pocket", // ₹99
        "usb-flash-drive-64gb", // ₹499
        "power-bank-10000", // ₹999
        "college-backpack", // ₹899
        "sticky-notes-pad", // ₹110
        "wired-earphones", // ₹349
      ];

      candidatePool.sort((a, b) => {
        const indexA = priorityOrder.indexOf(a.id);
        const indexB = priorityOrder.indexOf(b.id);
        const pA = indexA === -1 ? 999 : indexA;
        const pB = indexB === -1 ? 999 : indexB;
        return pA - pB;
      });

      const selectedItems: ShoppingPlanItem[] = [];
      let total = 0;

      for (const prod of candidatePool) {
        if (total + prod.priceMinor <= budgetMinor) {
          selectedItems.push({
            productId: prod.id,
            quantity: 1,
            unitPriceMinor: prod.priceMinor,
          });
          total += prod.priceMinor;
        }
      }

      return {
        withinBudget: total <= budgetMinor,
        budgetMinor,
        budgetDisplay: formatInr(budgetMinor),
        totalMinor: total,
        totalDisplay: formatInr(total),
        remainingBudgetMinor: budgetMinor - total,
        remainingBudgetDisplay: formatInr(budgetMinor - total),
        itemCount: selectedItems.length,
        items: selectedItems.map((item) => {
          const cat = getProductById(item.productId)!;
          return {
            productId: item.productId,
            name: cat.name,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            unitPriceDisplay: formatInr(item.unitPriceMinor),
            subtotalMinor: item.unitPriceMinor * item.quantity,
            subtotalDisplay: formatInr(item.unitPriceMinor * item.quantity),
          };
        }),
      };
    },
  },

  // ─── 4. verify_plan ───
  {
    name: "verify_plan",
    description:
      "Verify a candidate shopping plan against the catalog and budget. Returns structured errors and corrected totals.",
    parameters: {
      type: "object",
      properties: {
        plan: {
          type: "object",
          description: "The complete ShoppingPlan candidate object to validate.",
        },
      },
      required: ["plan"],
    },
    run: async ({ plan }) => {
      const result = validatePlan(plan);
      return {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        priceMismatches: result.priceMismatches,
        recomputedTotalMinor: result.validatedPlan?.totalMinor,
        recomputedTotalDisplay: result.validatedPlan ? formatInr(result.validatedPlan.totalMinor) : undefined,
      };
    },
  },

  // ─── 5. prepare_intent ───
  {
    name: "prepare_intent",
    description:
      "Finalize a validated shopping plan, canonicalize it, compute its cryptographic keccak256 hash, and store it off-chain.",
    parameters: {
      type: "object",
      properties: {
        intentId: {
          type: "string",
          description: "Existing intent ID (32-byte hex) if updating, or omit to generate a new one.",
        },
        budgetMinor: {
          type: "number",
          description: "Budget limit in paise.",
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["productId", "quantity"],
          },
          description: "Items in the plan.",
        },
        expiryHoursFromNow: {
          type: "number",
          description: "Commitment validity window in hours (default: 168 = 7 days).",
        },
      },
      required: ["budgetMinor", "items"],
    },
    run: async ({ intentId, budgetMinor, items, expiryHoursFromNow = 168 }) => {
      const activeIntentId: `0x${string}` =
        intentId && /^0x[0-9a-fA-F]{64}$/.test(intentId)
          ? (intentId.toLowerCase() as `0x${string}`)
          : generateIntentId();

      const previousRecord = getLatestPlanRecord(activeIntentId);
      const nextVersion = previousRecord ? previousRecord.version + 1 : 1;

      const expiry = Math.floor(Date.now() / 1000) + Math.round(expiryHoursFromNow * 3600);

      // Map items with catalog prices
      const planItems: ShoppingPlanItem[] = items.map((i: any) => {
        const cat = getProductById(i.productId);
        return {
          productId: i.productId,
          quantity: Math.max(1, Math.round(i.quantity || 1)),
          unitPriceMinor: cat ? cat.priceMinor : 0,
        };
      });

      const initialTotal = planItems.reduce((acc, curr) => acc + curr.unitPriceMinor * curr.quantity, 0);

      const candidatePlan: ShoppingPlan = {
        schemaVersion: "1.0.0",
        intentId: activeIntentId,
        version: nextVersion,
        currency: CURRENCY,
        budgetMinor: Math.round(budgetMinor),
        items: planItems,
        totalMinor: initialTotal,
        expiry,
      };

      if (isSaltingEnabled()) {
        candidatePlan.salt = generateSalt();
      }

      // Validate plan
      const validation = validatePlan(candidatePlan);
      if (!validation.valid || !validation.validatedPlan) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
          priceMismatches: validation.priceMismatches,
        };
      }

      const finalPlan = validation.validatedPlan;
      const { canonicalString, planHash } = computePlanHash(finalPlan);
      const stored = savePlanRecord(finalPlan, canonicalString, planHash);

      // Compute diff if revision
      let diff = null;
      if (previousRecord) {
        diff = computePlanDiff(previousRecord.plan, finalPlan);
      }

      return {
        success: true,
        intentId: finalPlan.intentId,
        version: finalPlan.version,
        isRevision: Boolean(previousRecord),
        budgetDisplay: formatInr(finalPlan.budgetMinor),
        totalDisplay: formatInr(finalPlan.totalMinor),
        planHash,
        canonicalString,
        plan: finalPlan,
        diff,
        message: previousRecord
          ? `Plan revised successfully to Version ${finalPlan.version}. Previous Version ${previousRecord.version} remains preserved.`
          : `Plan prepared successfully as Version 1.`,
      };
    },
  },

  // ─── 6. read_intent ───
  {
    name: "read_intent",
    description:
      "Read the on-chain commitment from the Base Sepolia contract and verify it against the stored off-chain plan.",
    parameters: {
      type: "object",
      properties: {
        intentId: {
          type: "string",
          description: "The 32-byte hex intent ID.",
        },
        version: {
          type: "number",
          description: "Optional specific version to query. If omitted, queries latest version.",
        },
      },
      required: ["intentId"],
    },
    run: async ({ intentId, version }) => {
      const normalizedIntentId = intentId.toLowerCase();
      const contractAddress = getRegistryContractAddress();
      const allOffChain = getAllPlanVersions(normalizedIntentId);

      let onChainData: any = null;
      let onChainAvailable = false;

      if (contractAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          const queryVersion =
            version ||
            (await publicClient.readContract({
              address: contractAddress,
              abi: SHOPPING_INTENT_REGISTRY_ABI,
              functionName: "getLatestVersion",
              args: [normalizedIntentId as Hex],
            }));

          if (queryVersion > 0) {
            const commitment = await publicClient.readContract({
              address: contractAddress,
              abi: SHOPPING_INTENT_REGISTRY_ABI,
              functionName: "getCommitment",
              args: [normalizedIntentId as Hex, queryVersion],
            });

            const isValid = await publicClient.readContract({
              address: contractAddress,
              abi: SHOPPING_INTENT_REGISTRY_ABI,
              functionName: "isIntentValid",
              args: [normalizedIntentId as Hex],
            });

            onChainData = {
              owner: commitment[0],
              planHash: commitment[1],
              version: Number(commitment[2]),
              expiry: Number(commitment[3]),
              isValid,
            };
            onChainAvailable = true;
          }
        } catch (err) {
          console.warn("Could not read contract on Base Sepolia:", err);
        }
      }

      const targetVersion = onChainData ? onChainData.version : version || (allOffChain[allOffChain.length - 1]?.version ?? 1);
      const stored = getPlanRecord(normalizedIntentId, targetVersion);

      const hashMatch =
        onChainAvailable && stored
          ? onChainData.planHash.toLowerCase() === stored.planHash.toLowerCase()
          : false;

      return {
        intentId: normalizedIntentId,
        versionQueried: targetVersion,
        contractAddress,
        network: "Base Sepolia (84532)",
        onChain: onChainData,
        onChainAvailable,
        offChainStored: stored ? { version: stored.version, planHash: stored.planHash } : null,
        hashMatch,
        allKnownVersions: allOffChain.map((o) => o.version),
      };
    },
  },

  // ─── 7. prepare_transaction ───
  {
    name: "prepare_transaction",
    description:
      "Prepare calldata and parameters for MetaMask approval. HARD RULE: Does NOT sign or send transactions.",
    parameters: {
      type: "object",
      properties: {
        intentId: {
          type: "string",
          description: "The 32-byte hex intent ID.",
        },
        version: {
          type: "number",
          description: "The plan version to record.",
        },
      },
      required: ["intentId", "version"],
    },
    run: async ({ intentId, version }) => {
      const normalizedIntentId = intentId.toLowerCase();
      const stored = getPlanRecord(normalizedIntentId, version);
      if (!stored) {
        throw new Error(`Plan for intent ${intentId} version ${version} not found in storage.`);
      }

      const contractAddress = getRegistryContractAddress();
      const functionName = version === 1 ? "recordIntent" : "recordVersion";
      const args = [
        stored.intentId as Hex,
        stored.planHash as Hex,
        stored.version,
        BigInt(stored.plan.expiry),
      ] as const;

      const calldata = encodeFunctionData({
        abi: SHOPPING_INTENT_REGISTRY_ABI,
        functionName,
        args,
      });

      return {
        to: contractAddress,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        networkName: "Base Sepolia",
        functionName,
        args: {
          intentId: stored.intentId,
          planHash: stored.planHash,
          version: stored.version,
          expiry: stored.plan.expiry,
        },
        calldata,
        value: "0",
        disclaimer: "This records a commitment to your approved plan. It does not place an order.",
      };
    },
  },

  // ─── 8. verify_transaction ───
  {
    name: "verify_transaction",
    description:
      "Verify transaction receipt and verify that the on-chain committed hash exactly matches the stored canonical plan hash.",
    parameters: {
      type: "object",
      properties: {
        txHash: { type: "string", description: "The transaction hash on Base Sepolia." },
        intentId: { type: "string", description: "The 32-byte hex intent ID." },
        version: { type: "number", description: "The version recorded." },
      },
      required: ["txHash", "intentId", "version"],
    },
    run: async ({ txHash, intentId, version }) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as Hash,
      });

      const contractAddress = getRegistryContractAddress();
      const commitment = await publicClient.readContract({
        address: contractAddress,
        abi: SHOPPING_INTENT_REGISTRY_ABI,
        functionName: "getCommitment",
        args: [intentId.toLowerCase() as Hex, version],
      });

      const onChainHash = commitment[1];
      const stored = getPlanRecord(intentId, version);

      const matches = stored
        ? stored.planHash.toLowerCase() === onChainHash.toLowerCase()
        : false;

      if (matches) {
        updateOnChainStatus(intentId, version, {
          txHash: txHash as Hex,
          blockNumber: Number(receipt.blockNumber),
          timestamp: Math.floor(Date.now() / 1000),
          status: "confirmed",
        });
      }

      return {
        txHash,
        status: receipt.status === "success" ? "confirmed" : "failed",
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        onChainHash,
        storedHash: stored?.planHash,
        hashesMatch: matches,
        basescanUrl: `https://sepolia.basescan.org/tx/${txHash}`,
        message: matches
          ? "On-chain commitment verified! Stored plan reproduces the exact on-chain hash."
          : "CRITICAL: Hash mismatch between on-chain commitment and stored plan.",
      };
    },
  },
];
