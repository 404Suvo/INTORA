/**
 * CLIENT-FACING CONCIERGE & ASK INTORA INTERFACE
 *
 * Provides client helpers for interacting with Ask Intora:
 * - Multi-turn conversation management
 * - Contextual application telemetry (route, plan status, active budget, active errors)
 * - Streaming response parser via Server-Sent Events (SSE)
 * - Resilient fallback to grounded local engine if network fails
 */

import { ShoppingPlanData } from "@/data/mockData";
import { PRODUCT_CATALOG } from "./catalog";
import { INTORA_KNOWLEDGE } from "./intora-knowledge";

export interface ConciergeProduct {
  id: string;
  name: string;
  category: string;
  priceRupees: number;
  inStock: boolean;
  unit: string;
  description: string;
}

export interface ConciergeResponse {
  text: string;
  planSnippet?: ShoppingPlanData;
  products?: ConciergeProduct[];
  suggestedPrompts?: string[];
  toolTraces?: Array<{ tool: string; args: unknown; result: unknown }>;
  isError?: boolean;
}

export interface ClientContextPayload {
  pathname?: string;
  hasPlan?: boolean;
  planSummary?: {
    id?: string;
    title?: string;
    situation?: string;
    budget?: number;
    totalAmount?: number;
    remainingAmount?: number;
    itemCount?: number;
    version?: number;
    planHash?: string;
    isBudgetCompliant?: boolean;
  };
  activeBudget?: number;
  activeError?: {
    message?: string;
    errorCode?: string;
    isTimeout?: boolean;
    isRetryable?: boolean;
  } | string | null;
  walletAccount?: string | null;
  walletChainId?: number | null;
}

/**
 * Intelligent deterministic local reply grounded in authoritative INTORA_KNOWLEDGE.
 * Runs in browser if network is completely offline.
 */
export function getLocalConciergeReply(
  userMessage: string,
  context?: ClientContextPayload
): ConciergeResponse {
  const q = userMessage.toLowerCase().trim();

  // 1. Out-of-scope filter
  const isOutOfScope =
    /^(write a (poem|story|song|essay|python script|code)|who is the president|what is the capital of|solve this equation|help with (my )?homework)/i.test(
      q
    ) &&
    !q.includes("intora") &&
    !q.includes("plan") &&
    !q.includes("shopping") &&
    !q.includes("budget") &&
    !q.includes("base sepolia") &&
    !q.includes("metamask") &&
    !q.includes("x402");

  if (isOutOfScope) {
    return {
      text: INTORA_KNOWLEDGE.scopeBoundaries.declineMessage,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does the budget optimizer work? 💡",
        "How does x402 work in Intora? ⚡",
        "How do I verify a plan on Base Sepolia? ⛓️",
      ],
    };
  }

  // 2. Greetings
  if (
    /\b(hi|hello|hey|greetings|namaste|good morning|good afternoon|good evening|who are you|what can you (help|do)|help me|introduce yourself)\b/i.test(
      q
    )
  ) {
    return {
      text:
        `Hello! I am **Ask Intora**, your conversational AI guide for the Intora website.\n\n` +
        `I'm delighted to assist you today! Here is what I can help you with:\n` +
        `• **Create & Revise Shopping Plans**: Provide a situation and rupee budget (₹100 to ₹2,00,000).\n` +
        `• **Budget Optimization & Trade-Offs**: Understand how our knapsack optimizer protects essential items.\n` +
        `• **x402 Micro-Payments**: Learn how AI agents pay $0.01 USDC on Base Sepolia for deep research.\n` +
        `• **Base Sepolia Commitments**: Verify tamper-proof Keccak-256 hashes via MetaMask.\n` +
        `• **Troubleshooting**: Diagnose search timeouts, 4001 wallet rejections, or budget shortfalls.\n\n` +
        `How may I assist you today?`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "What if I change the budget? 💰",
        "How does x402 work in Intora? ⚡",
        "How do I verify my plan on Base Sepolia? ⛓️",
      ],
    };
  }

  // 3. Simplified explanation
  if (
    q.includes("explain that more simply") ||
    q.includes("simpler") ||
    q.includes("simple terms") ||
    q.includes("eli5")
  ) {
    return {
      text:
        `Certainly! Here is Intora in simple terms:\n\n` +
        `1. **You describe your event and budget**: You tell us what you're planning and your budget ceiling in rupees.\n` +
        `2. **Intora selects verified products**: It picks real items that fit your budget, swapping expensive brands for cheaper ones so you don't overspend.\n` +
        `3. **You lock in a digital receipt**: You can record the approved plan onto the Base Sepolia testnet using MetaMask. It's free and creates permanent proof of what was agreed.\n\n` +
        `Would you like to try making a plan in the Live Demo?`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does the budget optimizer work? 💡",
        "How do I verify a plan on Base Sepolia? ⛓️",
      ],
    };
  }

  // 4. How to create a plan
  if (
    q.includes("create a shopping plan") ||
    q.includes("how do i make a plan") ||
    q.includes("how to plan")
  ) {
    return {
      text:
        `Creating a shopping plan on Intora is simple:\n\n` +
        `**What it does**: Curates a complete bundle of genuine catalog items strictly respecting your rupee budget.\n\n` +
        `**Where to go**:\n` +
        `• On the **Home Page**: Scroll down to the **Live Planner Demo** ('#demo').\n` +
        `• Or open the **Full Planner** at \`/planner\` for version branching and What-If simulations.\n\n` +
        `**Steps**:\n` +
        `1. Enter your situation (e.g. *"College fest for 50 students"*).\n` +
        `2. Set your rupee budget (between ₹100 and ₹2,00,000).\n` +
        `3. Click **'Optimize Plan'** (or **'Generate Intelligent Plan'** on \`/planner\`).\n` +
        `4. Review the items, total cost, and buffer.\n` +
        `5. Click **'Approve Plan & Record on Chain'** to commit your plan on Base Sepolia.`,
      suggestedPrompts: [
        "What if I change the budget? 💰",
        "How do I verify my plan on Base Sepolia? ⛓️",
        "How does the What-If simulator work? 🔮",
      ],
    };
  }

  // 5. Changing budget
  if (q.includes("change the budget") || q.includes("budget optimizer") || q.includes("cheaper")) {
    return {
      text:
        `Here is how Intora handles budget changes:\n\n` +
        `• **Integer Paise Calculation**: Intora computes all prices in integer paise (1 INR = 100 paise) between ₹100 and ₹2,00,000.\n` +
        `• **Reducing Budget**: Our knapsack optimizer automatically swaps items for cheaper alternatives via the **Trade-Off Engine** or removes optional items, preserving what is essential.\n` +
        `• **What-If Simulator**: In \`/planner\`, enter scenario prompts like *"Cut budget by 20%"* to create a non-destructive Version 2 with a side-by-side diff.\n` +
        `• **Infeasible Overruns**: If essential items exceed the budget, Intora states the shortfall honestly rather than fabricating fake prices.`,
      suggestedPrompts: [
        "What is the What-If simulator? 🔮",
        "How does the Trade-Off engine work? ⚖️",
        "How do I create a shopping plan? 🎒",
      ],
    };
  }

  // 6. x402 Protocol
  if (q.includes("x402") || q.includes("http 402") || q.includes("payment status")) {
    return {
      text:
        `**x402 Protocol in Intora**:\n\n` +
        `• **Purpose**: Enables autonomous agent micro-payments ($0.01 USDC on Base Sepolia) to unlock verified deep product intelligence (\`/api/research/product\`).\n` +
        `• **Workflow**: The agent signs an **EIP-3009** authorization and submits it to the facilitator (https://x402.org/facilitator) without requiring real user funds.\n` +
        `• **7 Payment Lifecycle Statuses**:\n` +
        `  1. *Ready*\n` +
        `  2. *Payment required*\n` +
        `  3. *Authorizing*\n` +
        `  4. *Submitting settlement*\n` +
        `  5. *Confirmed* (with Basescan txHash link)\n` +
        `  6. *Failed*\n` +
        `  7. *Pending verification*\n\n` +
        `*Rule: HTTP 200 alone is never proof of settlement without verified Basescan telemetry.*`,
      suggestedPrompts: [
        "How do I verify a plan on Base Sepolia? ⛓️",
        "Why did my product search fail? 🔍",
        "How do I create a shopping plan? 🎒",
      ],
    };
  }

  // 7. Blockchain verification
  if (
    q.includes("blockchain") ||
    q.includes("verify my plan") ||
    q.includes("base sepolia") ||
    q.includes("metamask")
  ) {
    return {
      text:
        `**Base Sepolia Blockchain Commitments**:\n\n` +
        `• **Contract**: \`ShoppingIntentRegistry\` at \`0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f\` on Base Sepolia (Chain ID 84532).\n` +
        `• **What It Does**: Records a deterministic **Keccak-256** hash of your approved plan, ensuring nobody can alter the agreed SKUs, quantities, or prices.\n` +
        `• **How to Verify**:\n` +
        `  1. Click **'Approve Plan & Record on Chain'** in the Live Demo or \`/planner\`.\n` +
        `  2. Ensure MetaMask is on Base Sepolia.\n` +
        `  3. Confirm the free testnet transaction in MetaMask.\n` +
        `  4. View the permanent proof on Basescan or in \`/history\`.\n\n` +
        `*Notice: This is completely free on testnet. It does not place an order or charge a credit card.*`,
      suggestedPrompts: [
        "Where can I find the transaction hash? 🔗",
        "What if I reject the MetaMask popup? 🦊",
        "How does the What-If simulator work? 🔮",
      ],
    };
  }

  // 8. Search failure troubleshooting
  if (
    q.includes("product search fail") ||
    q.includes("search fail") ||
    q.includes("search failing") ||
    q.includes("timeout")
  ) {
    return {
      text:
        `Product search may encounter an issue due to:\n\n` +
        `1. **ScraperAPI Timeout (504 PROVIDER_TIMEOUT)**: Amazon India search timed out (>20s) due to upstream latency. Click **'Retry Search'** or submit your prompt again.\n` +
        `2. **Missing ScraperAPI Key (503)**: Intora automatically falls back to its 50+ item verified in-memory catalog.\n` +
        `3. **Gemini Quota (429)**: Free-tier limit reached; Intora's circuit breaker runs the deterministic catalog optimizer.\n` +
        `4. **MetaMask Rejection (4001)**: You cancelled the popup. Simply click confirm when ready.`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does the budget optimizer work? 💡",
        "What items are in the catalog? 📦",
      ],
    };
  }

  // 9. Non-existent feature
  if (q.includes("bitcoin") || q.includes("lightning") || q.includes("pizza") || q.includes("flight")) {
    return {
      text:
        `Intora does not support this feature.\n\n` +
        `Intora specializes in **budget-grounded shopping plans**, **x402 USDC micro-payments**, and **Base Sepolia blockchain commitments**. It does not support Bitcoin Lightning, food delivery, or travel bookings.`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does x402 work in Intora? ⚡",
        "How do I verify on Base Sepolia? ⛓️",
      ],
    };
  }

  // 10. Catalog search
  const matched = PRODUCT_CATALOG.filter(
    (p) =>
      q.includes(p.name.toLowerCase()) ||
      q.includes(p.category.toLowerCase()) ||
      q.includes(p.id.toLowerCase())
  );

  if (matched.length > 0) {
    return {
      text:
        `Here are matching verified items from our catalog:\n\n` +
        matched
          .slice(0, 5)
          .map(
            (p) =>
              `• **${p.name}** (₹${p.priceMinor / 100}) - *${p.category}*\n  ${p.description} (${p.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        `\n\nWould you like me to curate a customized bundle with these items for your budget?`,
      products: matched.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceRupees: p.priceMinor / 100,
        inStock: p.inStock,
        unit: p.unit,
        description: p.description,
      })),
      suggestedPrompts: [
        "Create a plan with these items 🎒",
        "What is the budget optimizer? 💰",
        "How does MetaMask verification work? 🦊",
      ],
    };
  }

  // 11. Catch-all
  return {
    text:
      `I am **Ask Intora**, your specialized AI guide for the Intora website.\n\n` +
      `I can help you:\n` +
      `• Create and optimize shopping plans within rupee budgets (₹100 to ₹2,00,000).\n` +
      `• Understand the *What-If Simulator* and *Trade-Off Engine*.\n` +
      `• Explain *x402 micro-payments* ($0.01 USDC on Base Sepolia).\n` +
      `• Guide you through *Base Sepolia MetaMask verification*.\n` +
      `• Troubleshoot search timeouts or wallet errors.\n\n` +
      `What would you like to explore?`,
    suggestedPrompts: [
      "How do I create a shopping plan? 🎒",
      "What if I change the budget? 💰",
      "How does x402 work in Intora? ⚡",
      "How do I verify my plan on Base Sepolia? ⛓️",
    ],
  };
}

/**
 * Main client function to get an Ask Intora response.
 * Supports streaming callbacks, client context forwarding, and seamless fallback.
 */
export async function getConciergeResponse(
  userMessage: string,
  history: Array<{ sender: "user" | "bot"; text: string }> = [],
  context?: ClientContextPayload,
  onChunk?: (chunk: string, accumulated: string) => void
): Promise<ConciergeResponse> {
  const formattedMessages = [...history, { sender: "user", text: userMessage }];

  if (typeof window !== "undefined") {
    // 1. Try streaming request via /api/chat if onChunk callback provided
    if (onChunk) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: formattedMessages,
            context,
            stream: true,
          }),
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedText = "";
          let finalResponse: ConciergeResponse | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const eventData = JSON.parse(line.slice(6));
                  if (eventData.type === "chunk" && eventData.text) {
                    accumulatedText += eventData.text;
                    onChunk(eventData.text, accumulatedText);
                  } else if (eventData.type === "done") {
                    finalResponse = {
                      text: eventData.text || accumulatedText,
                      planSnippet: eventData.planSnippet,
                      products: eventData.products,
                      suggestedPrompts: eventData.suggestedPrompts,
                      toolTraces: eventData.toolTraces,
                    };
                  }
                } catch {
                  // Partial JSON chunk
                }
              }
            }
          }

          if (finalResponse) {
            return finalResponse;
          }

          if (accumulatedText.trim()) {
            return {
              text: accumulatedText.trim(),
              suggestedPrompts: [
                "How do I create a shopping plan? 🎒",
                "How does x402 work in Intora? ⚡",
                "How do I verify on Base Sepolia? ⛓️",
              ],
            };
          }
        }
      } catch (streamErr) {
        console.warn("[Ask Intora] Stream fetch failed, attempting non-streaming:", streamErr);
      }
    }

    // 2. Standard non-streaming POST /api/chat
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: formattedMessages,
          context,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          return {
            text: data.text,
            planSnippet: data.planSnippet,
            products: data.products,
            suggestedPrompts: data.suggestedPrompts,
            toolTraces: data.toolTraces,
          };
        }
      }
    } catch (apiErr) {
      console.warn("[Ask Intora] API chat route failed, falling back to local engine:", apiErr);
    }
  }

  // 3. Resilient deterministic local fallback
  return getLocalConciergeReply(userMessage, context);
}
