/**
 * SERVER-SIDE TOOLS FOR ASK INTORA ASSISTANT
 *
 * Grounded in actual Intora backend implementations:
 * - Product catalog (lib/catalog.ts)
 * - Plan storage (lib/plan-storage.ts)
 * - Base Sepolia Smart Contract queries (lib/contract-config.ts)
 * - x402 payment configurations (lib/x402-config.ts)
 * - Error diagnosis & recovery guidelines (lib/intora-knowledge.ts)
 */

import { createPublicClient, http, type Address, isAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { PRODUCT_CATALOG, searchCatalog } from "./catalog";
import { getPlanRecord, getLatestPlanRecord, getAllPlanVersions } from "./plan-storage";
import {
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  SHOPPING_INTENT_REGISTRY_ABI,
  getRegistryContractAddress,
} from "./contract-config";
import {
  getAgentAccount,
  getAgentWalletBalances,
  BASE_SEPOLIA_USDC_ADDRESS,
  DEFAULT_RESEARCH_PRICE,
  MAX_PAYMENT_USD,
  BASE_SEPOLIA_EXPLORER_BASE,
} from "./x402-config";
import { INTORA_KNOWLEDGE } from "./intora-knowledge";

export interface AssistantToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: any, context?: any) => Promise<unknown>;
}

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC || DEFAULT_BASE_SEPOLIA_RPC),
});

export const assistantTools: AssistantToolDeclaration[] = [
  {
    name: "get_page_and_feature_guide",
    description:
      "Retrieves verified implementation details, UI locations, and step-by-step instructions for any Intora page or feature (e.g. planner, what-if, trade-offs, x402, blockchain verification, history).",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The specific page or feature to look up (e.g., 'planner', 'what-if', 'trade-offs', 'x402', 'blockchain', 'history', 'budget').",
        },
      },
      required: ["topic"],
    },
    run: async ({ topic }) => {
      const q = String(topic || "").toLowerCase();

      // Check pages
      const pageMatch = INTORA_KNOWLEDGE.pages.find(
        (p) => p.path.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );

      // Check features
      const featureMatch = INTORA_KNOWLEDGE.features.find(
        (f) =>
          f.id.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          q.includes(f.id.replace(/_/g, " "))
      );

      if (featureMatch) {
        return {
          found: true,
          type: "feature",
          feature: featureMatch,
        };
      }

      if (pageMatch) {
        return {
          found: true,
          type: "page",
          page: pageMatch,
        };
      }

      return {
        found: true,
        type: "overview",
        pages: INTORA_KNOWLEDGE.pages.map((p) => ({ name: p.name, path: p.path, purpose: p.purpose })),
        features: INTORA_KNOWLEDGE.features.map((f) => ({ id: f.id, name: f.name, summary: f.oneSentenceSummary })),
      };
    },
  },

  {
    name: "search_verified_catalog",
    description:
      "Searches Intora's authoritative, verified in-memory product catalog for real items, unit prices in ₹, stock status, and categories. Never invents products.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword or item name (e.g., 'notebook', 'water bottle', 'snack', 'charger').",
        },
        category: {
          type: "string",
          description: "Optional category filter (e.g., 'stationery', 'snacks', 'electronics', 'outdoor', 'hygiene').",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default 6).",
        },
      },
      required: ["query"],
    },
    run: async ({ query, category, maxResults = 6 }) => {
      const q = String(query || "").trim().toLowerCase();
      let matches = PRODUCT_CATALOG.filter((p) => {
        const matchesQuery =
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q);
        const matchesCategory = category ? p.category.toLowerCase() === category.toLowerCase() : true;
        return matchesQuery && matchesCategory;
      });

      if (matches.length === 0 && q.length > 2) {
        // Fallback search with individual tokens
        const tokens = q.split(/\s+/).filter((t) => t.length > 2);
        matches = PRODUCT_CATALOG.filter((p) =>
          tokens.some(
            (t) =>
              p.name.toLowerCase().includes(t) ||
              p.category.toLowerCase().includes(t) ||
              p.description.toLowerCase().includes(t)
          )
        );
      }

      const results = matches.slice(0, Math.min(Number(maxResults) || 6, 12)).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceRupees: p.priceMinor / 100,
        inStock: p.inStock,
        availableStock: p.availableStock,
        unit: p.unit,
        description: p.description,
      }));

      return {
        totalMatches: matches.length,
        results,
      };
    },
  },

  {
    name: "check_shopping_plan_details",
    description:
      "Retrieves the verified stored shopping plan and all historical versions for a given intentId.",
    parameters: {
      type: "object",
      properties: {
        intentId: {
          type: "string",
          description: "The unique intent ID (e.g. '0x...' or plan ID) to look up.",
        },
        version: {
          type: "number",
          description: "Optional specific version number to fetch. If omitted, fetches the latest version.",
        },
      },
      required: ["intentId"],
    },
    run: async ({ intentId, version }) => {
      if (!intentId) {
        return { error: "An intentId is required to look up plan details." };
      }

      const record =
        version !== undefined
          ? getPlanRecord(intentId, Number(version))
          : getLatestPlanRecord(intentId);

      const allVersions = getAllPlanVersions(intentId);

      if (!record) {
        return {
          found: false,
          message: `No stored plan record was found for intentId "${intentId}". The plan may only exist in local browser session.`,
          availableVersionsCount: allVersions.length,
        };
      }

      return {
        found: true,
        intentId: record.plan.intentId,
        version: record.plan.version,
        currency: record.plan.currency,
        budgetInr: record.plan.budgetMinor / 100,
        totalInr: record.plan.totalMinor / 100,
        itemCount: record.plan.items.length,
        items: record.plan.items.map((it: any) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPriceInr: it.unitPriceMinor / 100,
        })),
        planHash: record.planHash,
        onChainCommitment: record.onChainCommitment,
        availableVersions: allVersions.map((v) => ({
          version: v.plan.version,
          totalInr: v.plan.totalMinor / 100,
          onChain: v.onChainCommitment?.status === "confirmed",
        })),
      };
    },
  },

  {
    name: "check_blockchain_commitment",
    description:
      "Checks whether a shopping plan's Keccak-256 hash has been verified and committed to the ShoppingIntentRegistry smart contract on Base Sepolia.",
    parameters: {
      type: "object",
      properties: {
        intentId: {
          type: "string",
          description: "The 32-byte hex intent ID (0x...) of the plan.",
        },
        version: {
          type: "number",
          description: "The plan version number to query (defaults to latest if omitted).",
        },
      },
      required: ["intentId"],
    },
    run: async ({ intentId, version = 1 }) => {
      try {
        const contractAddress = getRegistryContractAddress();

        // Check format of intentId
        const formattedIntentId = intentId.startsWith("0x")
          ? (intentId.padEnd(66, "0").slice(0, 66) as `0x${string}`)
          : (`0x${intentId}`.padEnd(66, "0").slice(0, 66) as `0x${string}`);

        const result: any = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SHOPPING_INTENT_REGISTRY_ABI,
          functionName: "getCommitment",
          args: [formattedIntentId, Number(version)],
        });

        const owner = result[0] as string;
        const planHash = result[1] as string;
        const commitmentVersion = Number(result[2]);
        const expiry = Number(result[3]);

        const isCommitted = owner && owner !== "0x0000000000000000000000000000000000000000";

        return {
          network: "Base Sepolia (Chain ID 84532)",
          contractAddress,
          intentId: formattedIntentId,
          version: commitmentVersion || version,
          isCommitted,
          owner: isCommitted ? owner : null,
          planHash: isCommitted ? planHash : null,
          expiryTimestamp: isCommitted ? expiry : null,
          explorerUrl: isCommitted
            ? `https://sepolia.basescan.org/address/${contractAddress}`
            : null,
          statusSummary: isCommitted
            ? `Verified on Base Sepolia. Plan commitment hash: ${planHash}`
            : "No on-chain commitment found for this intent and version on Base Sepolia.",
        };
      } catch (err: any) {
        return {
          error: "Could not query Base Sepolia contract.",
          details: err?.message || String(err),
          contractAddress: getRegistryContractAddress(),
          network: "Base Sepolia (Chain ID 84532)",
        };
      }
    },
  },

  {
    name: "check_x402_status",
    description:
      "Retrieves actual x402 payment protocol configuration, agent wallet address, testnet balances, and payment lifecycle statuses on Base Sepolia.",
    parameters: {
      type: "object",
      properties: {},
    },
    run: async () => {
      try {
        const account = getAgentAccount();
        let ethBalance = "unknown";
        let usdcBalance = "unknown";

        if (account) {
          try {
            const balances = await getAgentWalletBalances(account.address);
            ethBalance = balances.ethBalance;
            usdcBalance = balances.usdcBalance;
          } catch {
            // balances fetch fallback
          }
        }

        return {
          protocol: "x402 HTTP Payment Required standard (EIP-3009)",
          network: "Base Sepolia (eip155:84532)",
          usdcContract: BASE_SEPOLIA_USDC_ADDRESS,
          researchPriceUsd: DEFAULT_RESEARCH_PRICE,
          spendingCapUsd: MAX_PAYMENT_USD,
          facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
          agentWallet: {
            address: account ? account.address : "Agent wallet unconfigured",
            hasPrivateKey: Boolean(process.env.X402_BUYER_PRIVATE_KEY),
            ethBalance,
            usdcBalance,
          },
          paymentLifecycleStatuses: [
            "Ready - Initial state before request",
            "Payment required - 402 status received with USDC quote ($0.01)",
            "Authorizing - EIP-3009 transfer signature constructed",
            "Submitting settlement - Payload submitted to x402 facilitator",
            "Confirmed - Settlement confirmed on Base Sepolia with txHash",
            "Failed - Errored (insufficient balance, network timeout)",
            "Pending verification - Submitted, awaiting on-chain block inclusion",
          ],
        };
      } catch (err: any) {
        return {
          protocol: "x402 HTTP Payment Required standard",
          network: "Base Sepolia (eip155:84532)",
          researchPriceUsd: DEFAULT_RESEARCH_PRICE,
          spendingCapUsd: MAX_PAYMENT_USD,
          note: "Agent wallet check unavailable or offline.",
          error: err?.message || String(err),
        };
      }
    },
  },

  {
    name: "diagnose_system_error",
    description:
      "Diagnoses known Intora errors (e.g. ScraperAPI timeout, 4001 wallet rejection, quota exhaustion, budget overruns) and provides exact recovery steps.",
    parameters: {
      type: "object",
      properties: {
        errorIndicator: {
          type: "string",
          description:
            "Error code, HTTP status, or error message (e.g. 'PROVIDER_TIMEOUT', '4001', '504', '429', 'infeasible', 'wrong network').",
        },
      },
      required: ["errorIndicator"],
    },
    run: async ({ errorIndicator }) => {
      const q = String(errorIndicator || "").toLowerCase();

      for (const err of INTORA_KNOWLEDGE.errors) {
        const httpStatus = "httpStatus" in err ? (err as any).httpStatus : undefined;
        const codeNumber = "codeNumber" in err ? (err as any).codeNumber : undefined;

        if (
          err.code.toLowerCase().includes(q) ||
          q.includes(err.code.toLowerCase()) ||
          (httpStatus !== undefined && q.includes(String(httpStatus))) ||
          (codeNumber !== undefined && q.includes(String(codeNumber))) ||
          q.includes(err.cause.toLowerCase().slice(0, 20))
        ) {
          return {
            identified: true,
            code: err.code,
            httpStatus,
            cause: err.cause,
            recoverySteps: err.recoverySteps,
          };
        }
      }

      return {
        identified: false,
        message:
          "This error is not in our known catalog. Typical troubleshooting: 1) Verify MetaMask is connected to Base Sepolia (84532), 2) Check budget is within ₹100 - ₹2,00,000, 3) Retry failed product searches, 4) Check /api/health for system status.",
      };
    },
  },
];
