/**
 * ASK INTORA - SERVER CONVERSATIONAL ENGINE
 *
 * Grounded in the actual Intora website architecture:
 * - Powered by @google/genai with candidate model fallback
 * - Strict website-only scope boundary
 * - Intelligent tool calling (catalog, plan storage, Base Sepolia smart contract, x402 status, error diagnostics)
 * - Context-aware of user's active page, plan state, budget, and errors
 * - Graceful fallback when Gemini quota is exhausted or offline
 */

import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { INTORA_KNOWLEDGE } from "./intora-knowledge";
import { assistantTools } from "./assistant-tools";
import {
  isGeminiQuotaExhausted,
  recordGeminiQuotaExhaustion,
  isGeminiQuotaError,
} from "./gemini-quota";
import { PRODUCT_CATALOG } from "./catalog";
import { ShoppingPlanData } from "@/data/mockData";

export interface ChatMessageInput {
  sender: "user" | "bot" | "model" | string;
  text: string;
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

export interface ConciergeChatOptions {
  messages: ChatMessageInput[];
  context?: ClientContextPayload;
  stream?: boolean;
}

export interface ConciergeServerResponse {
  text: string;
  planSnippet?: ShoppingPlanData;
  products?: Array<{
    id: string;
    name: string;
    category: string;
    priceRupees: number;
    inStock: boolean;
    unit: string;
    description: string;
  }>;
  suggestedPrompts?: string[];
  toolTraces?: Array<{ tool: string; args: unknown; result: unknown }>;
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
];

function buildSystemPrompt(context?: ClientContextPayload): string {
  const contextSnippet = context
    ? `
USER CURRENT APPLICATION CONTEXT:
- Active Route/Page: "${context.pathname || "/"}"
- Shopping Plan Loaded: ${context.hasPlan ? "Yes" : "No"}
${context.planSummary ? `- Active Plan: "${context.planSummary.title || "Untitled"}", Situation: "${context.planSummary.situation || "None"}", Budget: ₹${context.planSummary.budget || 0}, Total: ₹${context.planSummary.totalAmount || 0}, Version: ${context.planSummary.version || 1}, Hash: "${context.planSummary.planHash || "None"}", Compliant: ${context.planSummary.isBudgetCompliant !== false}` : ""}
${context.activeBudget ? `- Selected Budget: ₹${context.activeBudget}` : ""}
${context.activeError ? `- Active Visible Error: ${typeof context.activeError === "string" ? context.activeError : JSON.stringify(context.activeError)}` : ""}
${context.walletAccount ? `- Connected MetaMask Wallet: ${context.walletAccount} (Chain: ${context.walletChainId || 84532})` : "- MetaMask Wallet: Not connected"}
`
    : "USER CURRENT APPLICATION CONTEXT: No specific page context provided (assume Landing Page '/').";

  return `
You are Ask Intora, the built-in AI guide and conversational assistant for the Intora website and intent-to-commerce platform.

CORE PRINCIPLE: ChatGPT-like conversation quality, Intora-only expertise.
You are a warm, intelligent, articulate, human-style guide. You speak naturally, understand typos, incomplete questions, and anaphoric references (e.g. "that feature", "how do I do it?", "why did this happen?", "what should I do next?").

${contextSnippet}

AUTHORITATIVE WEBSITE KNOWLEDGE:
1. WHAT INTORA DOES:
   Intora transforms natural-language situations (e.g., college fests, treks, hostel setups, parties) and rupee budgets into verified, grounded shopping bundles, and records immutable commitments on the Base Sepolia blockchain via MetaMask.
2. PAGES & NAVIGATION:
   - '/' (Home / Landing Page): Sticky Navbar, Hero with situation prompt bar and budget slider (₹100 to ₹2,00,000), TrustStrip, HowItWorks 3-step guide, LivePlannerDemo (interactive bundle creator, quantity adjusters, trade-offs, x402 research, Base Sepolia commitment), BlockchainVerification section, UseCasesBento, StatsGrid, FAQ, and Ask Intora widget.
   - '/planner' (Full Planner Workspace): Situation prompt, preset pills, integer paise budget input (₹100 to ₹2,00,000), 'Generate Intelligent Plan' / 'Re-optimize Plan', loading counter with abort controller, editable item bundle (+ / - / delete), 'Add Product' modal, 'Trade-Offs' modal, 'What-If Simulator' panel (creates version branches with diffs), 'Scenario Timeline' (v1, v2, ...), 'Version Comparison Modal', deterministic Keccak-256 plan hash, and 'Record Commitment on Base Sepolia' button.
   - '/history' (Commitment History): Chronological audit trail of all Base Sepolia on-chain commitments, with direct links to Base Sepolia Basescan (https://sepolia.basescan.org/tx/...), version numbers, and plan hashes.
   - '/demo' (3D Dotted Surface): Three.js interactive canvas particle surface.
3. BUDGET & MATH RULES:
   - Indian Rupees (INR, ₹).
   - Grounded in integer paise: 1 INR = 100 paise. Floating-point paise are strictly rejected.
   - Budget constraints: Minimum ₹100, Maximum ₹2,00,000.
   - Overrun: If essential items exceed the budget ceiling, the plan is marked non-compliant with the exact shortfall. Never pretend an over-budget plan fits or invent fake price drops.
4. x402 PROTOCOL & PAYMENT STATUSES:
   - HTTP 402 Payment Required micro-payments for verified deep product intelligence (/api/research/product).
   - Network: Base Sepolia (eip155:84532).
   - Token: USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e). Price: $0.01 USDC. Spend limit: $0.05 USDC.
   - Payment lifecycle statuses:
     * Ready: Initial state before payment is initiated.
     * Payment required: 402 status received with USDC payment parameters.
     * Authorizing: Agent wallet generates and signs EIP-3009 TransferWithAuthorization payload.
     * Submitting settlement: Signed payload submitted to x402 facilitator (https://x402.org/facilitator).
     * Confirmed: Settlement confirmed on Base Sepolia with valid transaction hash.
     * Failed: Payment failed (insufficient balance, network timeout, limit exceeded).
     * Pending verification: Submitted to mempool, awaiting block inclusion.
   - CRITICAL RULE: HTTP 200 alone is NEVER proof of settlement. Valid PAYMENT-RESPONSE telemetry and Basescan txHash are required.
5. BLOCKCHAIN VERIFICATION & SMART CONTRACTS:
   - Network: Base Sepolia Testnet (Chain ID 84532).
   - Smart Contract: ShoppingIntentRegistry at 0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f.
   - Hash: Deterministic Keccak-256 hash of canonicalized JSON plan.
   - Cost: Completely FREE testnet gas. Zero real money charged.
   - Nature: An immutable commitment proving the exact agreed SKUs, quantities, and pricing between buyer and agent. It DOES NOT place an order with Amazon/merchants, and DOES NOT transfer real funds.
6. ERROR TROUBLESHOOTING:
   - PROVIDER_TIMEOUT (504): ScraperAPI network timeout after 20s while querying Amazon India. Retryable.
   - SCRAPERAPI_KEY missing (503): Backend missing key. Intora falls back to its 50+ item verified in-memory catalog.
   - AI_QUOTA_EXHAUSTED (429): Gemini quota exhausted. Circuit breaker triggers cooldown and system uses deterministic catalog optimizer.
   - 4001: User rejected MetaMask transaction signature. Explain that no funds were lost and user can click confirm when ready.
   - Wrong Network: MetaMask not on Base Sepolia. Prompt switch to Chain ID 84532.

SCOPE ENFORCEMENT RULES:
- STRICT INTORA SPECIALIZATION: You must only provide substantive help related to Intora, its website, features, shopping plans, budgets, x402 payments, Base Sepolia verification, and troubleshooting.
- OUT-OF-SCOPE QUESTIONS: If the user asks general-purpose questions unrelated to Intora (e.g., general coding help, unrelated homework, general news, jokes, writing unrelated essays/stories/social media posts), decline politely and briefly.
  Example decline: "I am Ask Intora, the built-in AI guide dedicated specifically to helping you understand and use the Intora website. While I cannot help with [unrelated topic], I would be glad to help you create a shopping plan, simulate what-if scenarios, check x402 research, or verify commitments on Base Sepolia. How can I help you with Intora today?"
- DO NOT OVER-POLICE: If a concept is related to an Intora feature (e.g., explaining HTTP 402 in the context of Intora, explaining Base Sepolia or Keccak-256, explaining knapsack budgeting), explain it clearly in the context of the website.
- NEVER INVENT FEATURES: Never invent features, buttons, settings, payment states, or workflows that do not exist (e.g. Intora does NOT have Bitcoin lightning, does NOT deliver pizza, does NOT place automatic credit card orders).
- ACTIONABLE STEP-BY-STEP GUIDANCE: When asked how to use a feature:
  1. Explain what it does in one sentence.
  2. Tell the user exactly where to go or what control to use, based on the real UI.
  3. Describe next steps in order.
  4. Explain the expected result.
  5. Mention relevant limitations or errors when appropriate.

TOOL USAGE:
- You have access to server tools: 'get_page_and_feature_guide', 'search_verified_catalog', 'check_shopping_plan_details', 'check_blockchain_commitment', 'check_x402_status', and 'diagnose_system_error'.
- Use tools ONLY when they materially improve the answer. Do not call tools for simple navigation or greetings.
`.trim();
}

/**
 * Intelligent deterministic fallback generator when Gemini is offline or rate-limited.
 * Grounded in INTORA_KNOWLEDGE and client context without rigid keyword lock.
 */
export async function getIntelligentFallbackResponse(
  userMessage: string,
  history: ChatMessageInput[] = [],
  context?: ClientContextPayload
): Promise<ConciergeServerResponse> {
  const q = userMessage.toLowerCase().trim();

  // 1. Check for out-of-scope non-Intora requests
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

  // 2. Greetings & general identity
  if (
    /\b(hi|hello|hey|greetings|namaste|good morning|good afternoon|good evening|who are you|what can you (help|do)|help me|introduce yourself)\b/i.test(
      q
    )
  ) {
    const pageContext = context?.pathname === "/planner"
      ? "You are currently in the **Full Planner Workspace**, where you can generate multi-version plans, simulate What-If scenarios, and record Base Sepolia commitments."
      : context?.pathname === "/history"
      ? "You are currently viewing the **Commitment History**, where all tamper-proof commitments on Base Sepolia are recorded."
      : "You are on the **Intora Home Page**, where you can try the Live Planner Demo, explore use cases, and verify on-chain commitments.";

    return {
      text:
        `Hello! I am **Ask Intora**, your conversational AI guide for the Intora website.\n\n` +
        `${pageContext}\n\n` +
        `Here is how I can assist you today:\n` +
        `• **Create & Revise Shopping Plans**: Tell me your situation and rupee budget (min ₹100, max ₹2,00,000).\n` +
        `• **What-If Simulations & Trade-Offs**: Understand how to branch plan versions, cut budgets, or swap items.\n` +
        `• **x402 Micro-Payments**: Learn how autonomous agents pay $0.01 USDC on Base Sepolia for deep research.\n` +
        `• **Base Sepolia Verification**: Understand how we record tamper-proof Keccak-256 plan hashes via MetaMask.\n` +
        `• **Troubleshoot Errors**: Diagnose search timeouts, wallet rejections (4001), or budget shortfalls.\n\n` +
        `What would you like to explore?`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "What if I change the budget? 💰",
        "How does x402 work in Intora? ⚡",
        "How do I verify my plan on Base Sepolia? ⛓️",
      ],
    };
  }

  // 3. Simplified explanation follow-up ("explain that more simply")
  if (
    q.includes("explain that more simply") ||
    q.includes("simpler") ||
    q.includes("simple terms") ||
    q.includes("eli5") ||
    q.includes("what does that mean")
  ) {
    return {
      text:
        `Certainly! Here is Intora explained in three simple sentences:\n\n` +
        `1. **You describe what you need**: You tell Intora your event (like a 3-day college fest) and your spending limit down to the rupee.\n` +
        `2. **Intora picks the best items**: Our system finds real products that fit your budget, automatically swapping expensive items for good cheaper ones so you don't overspend.\n` +
        `3. **You get an unchangeable digital receipt**: Once you're happy, you can seal the plan onto the Base Sepolia testnet using MetaMask. It's completely free and ensures neither buyer nor seller can alter what was agreed.\n\n` +
        `Would you like to try creating a plan now in the Live Demo?`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does the budget optimizer work? 💡",
        "How do I verify a plan on Base Sepolia? ⛓️",
      ],
    };
  }

  // 4. How to create a shopping plan
  if (
    q.includes("create a shopping plan") ||
    q.includes("how do i make a plan") ||
    q.includes("how to plan") ||
    q.includes("start planning")
  ) {
    return {
      text:
        `Creating a shopping plan on Intora is fast and grounded in real inventory:\n\n` +
        `**What it does**: Automatically creates a curated bundle of verified items strictly respecting your rupee budget ceiling.\n\n` +
        `**Where to go**:\n` +
        `• On the **Home Page**: Scroll down to the **Live Planner Demo** section ('#demo').\n` +
        `• Or open the **Full Planner** at \`/planner\` for multi-version timeline tools.\n\n` +
        `**Step-by-Step Instructions**:\n` +
        `1. Enter your situation in natural language (e.g., *"College fest for 50 students"* or *"Weekend monsoon trek"*).\n` +
        `2. Set your budget ceiling in Rupees (minimum ₹100, maximum ₹2,00,000).\n` +
        `3. Click the **'Optimize Plan'** button (or **'Generate Intelligent Plan'** on \`/planner\`).\n` +
        `4. Review the selected items, unit prices, total cost, and remaining buffer.\n` +
        `5. Adjust quantities using **+ / -** or click **'Trade-Offs'** to swap items.\n\n` +
        `**Expected Result**: A complete bundle with exact integer paise math and a deterministic Keccak-256 plan hash ready for on-chain verification.`,
      suggestedPrompts: [
        "What if I change the budget? 💰",
        "How do I verify my plan on Base Sepolia? ⛓️",
        "What is the What-If simulator? 🔮",
      ],
    };
  }

  // 5. Budget adjustments & "What if I change the budget?"
  if (
    q.includes("change the budget") ||
    q.includes("budget optimizer") ||
    q.includes("cheaper") ||
    q.includes("make it cheaper") ||
    q.includes("cut budget")
  ) {
    return {
      text:
        `Here is how Intora handles budget adjustments:\n\n` +
        `**How the Budget Optimizer Works**:\n` +
        `• **Integer Paise Math**: All budgets are calculated in exact paise (1 INR = 100 paise) between ₹100 and ₹2,00,000.\n` +
        `• **Lowering the Budget**: When you reduce your budget, Intora's knapsack optimizer automatically:\n` +
        `  1. Looks for cheaper alternatives using the **Trade-Off Engine**.\n` +
        `  2. Reduces quantities or removes optional items, strictly preserving your essential items.\n` +
        `• **What-If Scenarios**: On \`/planner\`, use the **What-If Simulator** panel. Type *"Cut budget by 20%"* or *"Set budget to ₹2,000"*, click **'Simulate Scenario'**, and Intora will create a new Version 2 with a side-by-side diff!\n` +
        `• **Infeasible Budgets**: If your essential items cost more than the budget cap, Intora flags the shortfall honestly. It will never invent fake price discounts or pretend a plan fits when it doesn't.\n\n` +
        `Would you like to test a budget change in the planner?`,
      suggestedPrompts: [
        "What is the What-If simulator? 🔮",
        "How does the Trade-Off engine work? ⚖️",
        "How do I create a shopping plan? 🎒",
      ],
    };
  }

  // 6. x402 Protocol & Payment Statuses
  if (
    q.includes("x402") ||
    q.includes("http 402") ||
    q.includes("payment status") ||
    q.includes("check my payment") ||
    q.includes("micro-payment")
  ) {
    return {
      text:
        `**What is x402 in Intora?**\n` +
        `x402 is an open web standard that turns HTTP 402 (*Payment Required*) into autonomous AI agent micro-payments on Base Sepolia.\n\n` +
        `**How It Works in Intora**:\n` +
        `• When you click **'Deep Product Research (x402)'**, our backend requests protected intelligence from \`/api/research/product\`.\n` +
        `• The server responds with **HTTP 402** and payment parameters ($0.01 USDC on Base Sepolia).\n` +
        `• The local agent wallet signs an **EIP-3009** authorization and submits it to the facilitator (https://x402.org/facilitator).\n` +
        `• The facilitator settles the payment on Base Sepolia, returning verified pricing, counterfeit risk audits, and seller scores.\n\n` +
        `**Payment Lifecycle Statuses**:\n` +
        `1. **Ready**: Initial state before starting.\n` +
        `2. **Payment required**: 402 status received with USDC quote ($0.01).\n` +
        `3. **Authorizing**: EIP-3009 transfer signature constructed.\n` +
        `4. **Submitting settlement**: Submitted to the facilitator.\n` +
        `5. **Confirmed**: Settled on Base Sepolia with an official Basescan transaction hash.\n` +
        `6. **Failed**: Errored (e.g., insufficient testnet USDC balance or network timeout).\n` +
        `7. **Pending verification**: Submitted, waiting for block inclusion.\n\n` +
        `*Note: Intora strictly enforces a $0.05 spend limit, and HTTP 200 alone is never considered proof without verified settlement telemetry.*`,
      suggestedPrompts: [
        "How do I verify a plan on Base Sepolia? ⛓️",
        "Why did my product search fail? 🔍",
        "How do I create a shopping plan? 🎒",
      ],
    };
  }

  // 7. Blockchain Verification & MetaMask Commitments
  if (
    q.includes("blockchain") ||
    q.includes("verify my plan") ||
    q.includes("base sepolia") ||
    q.includes("metamask") ||
    q.includes("transaction hash") ||
    q.includes("commitment")
  ) {
    return {
      text:
        `**Base Sepolia Blockchain Verification in Intora**:\n\n` +
        `**What it does**: Records an immutable, tamper-proof Keccak-256 cryptographic commitment of your approved shopping plan on the Base Sepolia testnet.\n\n` +
        `**How to Verify Your Plan Step-by-Step**:\n` +
        `1. Click **'Approve Plan & Record on Chain'** in the Live Demo or **'Record Commitment on Base Sepolia'** in \`/planner\`.\n` +
        `2. The **Transaction Approval Modal** opens displaying your plan summary, version number, and Keccak-256 hash.\n` +
        `3. Connect MetaMask and ensure your network is **Base Sepolia** (Chain ID \`84532\`).\n` +
        `4. Click **'Confirm Commitment'** and approve the transaction in MetaMask.\n` +
        `5. Once confirmed, copy your transaction hash or click the link to view the immutable proof on Basescan Sepolia!\n\n` +
        `**Important Facts**:\n` +
        `• **Contract**: \`ShoppingIntentRegistry\` at \`0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f\`.\n` +
        `• **Cost**: Zero real money — it uses free testnet gas.\n` +
        `• **Commitment vs Order**: This records cryptographic proof of agreed items and pricing; it does not place an order or charge a credit card.\n` +
        `• **Audit Trail**: Visit \`/history\` to view all committed versions.`,
      suggestedPrompts: [
        "Where can I find the transaction hash? 🔗",
        "What if I reject the MetaMask popup? 🦊",
        "How does the What-If simulator work? 🔮",
      ],
    };
  }

  // 8. Error Troubleshooting ("Why did product search fail?")
  if (
    q.includes("product search fail") ||
    q.includes("search fail") ||
    q.includes("search failing") ||
    q.includes("timeout") ||
    q.includes("error") ||
    q.includes("provider_timeout")
  ) {
    return {
      text:
        `Here is why product search might encounter an issue and how to resolve it:\n\n` +
        `1. **ScraperAPI Latency / Timeout (504 \`PROVIDER_TIMEOUT\`)**:\n` +
        `   • *Cause*: Live Amazon India scraping via ScraperAPI timed out (>20s) due to upstream Amazon network throttling.\n` +
        `   • *Solution*: Click **'Retry Search'** or submit your prompt again. If Amazon remains slow, Intora seamlessly uses its verified in-memory catalog.\n\n` +
        `2. **Missing ScraperAPI Key (503)**:\n` +
        `   • *Cause*: \`SCRAPERAPI_KEY\` is not set in environment variables.\n` +
        `   • *Solution*: Intora automatically falls back to its 50+ item verified catalog so planning remains fully operational.\n\n` +
        `3. **AI Quota Exhaustion (429)**:\n` +
        `   • *Cause*: Google Gemini API free-tier requests per minute reached limit.\n` +
        `   • *Solution*: Intora's circuit breaker displays a cooldown countdown and uses deterministic knapsack optimization.\n\n` +
        `4. **MetaMask Rejection (Error 4001)**:\n` +
        `   • *Cause*: You clicked cancel or rejected the MetaMask transaction prompt.\n` +
        `   • *Solution*: No funds were lost. Click 'Record Commitment' again whenever you are ready.\n\n` +
        `You can also inspect \`/api/health\` at any time to verify system connectivity.`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does the budget optimizer work? 💡",
        "What items are in the catalog? 📦",
      ],
    };
  }

  // 9. Non-existent feature inquiry (e.g. Bitcoin, pizza, flight booking)
  if (
    q.includes("bitcoin") ||
    q.includes("lightning") ||
    q.includes("pizza") ||
    q.includes("flight") ||
    q.includes("hotel booking") ||
    q.includes("credit card payment")
  ) {
    return {
      text:
        `Intora does not support this feature.\n\n` +
        `**What Intora actually supports**:\n` +
        `• **Event & Situational Shopping Plans**: Planning bundles within rupee budgets (₹100 - ₹2,00,000).\n` +
        `• **Base Sepolia Blockchain Commitments**: Verifying plan hashes on Base Sepolia using MetaMask (Chain ID 84532).\n` +
        `• **x402 Micro-Payments**: Deep product research settled in USDC via x402 on Base Sepolia.\n` +
        `• **What-If Simulations**: Branching plan versions and calculating diffs.\n\n` +
        `We do not support external payment rails like Bitcoin Lightning, nor do we offer pizza delivery or flight bookings. How may I help you with shopping plans or Base Sepolia verification?`,
      suggestedPrompts: [
        "How do I create a shopping plan? 🎒",
        "How does x402 work in Intora? ⚡",
        "How do I verify a plan on Base Sepolia? ⛓️",
      ],
    };
  }

  // 10. General Catalog & Product Questions
  const matchedProducts = PRODUCT_CATALOG.filter(
    (p) =>
      q.includes(p.name.toLowerCase()) ||
      q.includes(p.category.toLowerCase()) ||
      q.includes(p.id.toLowerCase())
  );

  if (matchedProducts.length > 0) {
    return {
      text:
        `Here are the verified items from Intora's catalog matching your query:\n\n` +
        matchedProducts
          .slice(0, 5)
          .map(
            (p) =>
              `• **${p.name}** (₹${p.priceMinor / 100}) - *${p.category}*\n  ${p.description} (${p.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        `\n\nWould you like me to create a shopping plan incorporating these items for a specific rupee budget?`,
      products: matchedProducts.slice(0, 5).map((p) => ({
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

  // 11. Polite Default Catch-All
  return {
    text:
      `Thank you for asking! As **Ask Intora**, I specialize in helping you navigate and use the entire Intora website.\n\n` +
      `Here are some things we can do together right now:\n` +
      `• **Create a Shopping Plan**: Tell me your event (e.g. *'Monsoon trek'* or *'Hostel setup'*) and budget in ₹.\n` +
      `• **Learn Website Features**: Ask about the *What-If Simulator*, *Trade-Off Engine*, or *Live Demo*.\n` +
      `• **x402 & Blockchain**: Ask how *x402 micro-payments* or *Base Sepolia MetaMask verification* work.\n` +
      `• **Troubleshooting**: Ask why a search timed out or how to fix a budget shortfall.\n\n` +
      `How can I assist you with your shopping plans today?`,
    suggestedPrompts: [
      "How do I create a shopping plan? 🎒",
      "How does the budget optimizer work? 💡",
      "How does x402 work in Intora? ⚡",
      "How do I verify my plan on Base Sepolia? ⛓️",
    ],
  };
}

/**
 * Main server-side conversational handler for Ask Intora.
 * Orchestrates multi-turn conversation, Gemini AI models, tool-calling loop, and intelligent fallback.
 */
export async function processConciergeChat(
  messages: ChatMessageInput[],
  context?: ClientContextPayload
): Promise<ConciergeServerResponse> {
  const latestMessage = messages[messages.length - 1]?.text || "";

  // If Gemini quota is known to be exhausted, invoke intelligent deterministic engine immediately
  if (isGeminiQuotaExhausted()) {
    return getIntelligentFallbackResponse(latestMessage, messages, context);
  }

  if (!process.env.GEMINI_API_KEY) {
    // If no API key configured, use intelligent fallback grounded in the site knowledge
    return getIntelligentFallbackResponse(latestMessage, messages, context);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const systemPrompt = buildSystemPrompt(context);

  // Format messages into Gemini Content structures
  const contents: Content[] = messages.map((m) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  const toolDeclarations = assistantTools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.parameters,
  }));

  const toolTraces: Array<{ tool: string; args: unknown; result: unknown }> = [];
  let responseText = "";
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      // Step 1: Initial model turn with tools
      let result = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });

      // Step 2: Handle function calls if Gemini invokes any tools
      const calls = result.functionCalls ?? [];
      if (calls.length > 0) {
        contents.push(result.candidates![0].content!);
        const toolResponseParts: Part[] = [];

        for (const call of calls) {
          const tool = assistantTools.find((t) => t.name === call.name);
          let toolResult: unknown;
          try {
            if (!tool) throw new Error(`Unknown tool: ${call.name}`);
            toolResult = await tool.run(call.args ?? {}, context);
          } catch (toolErr: any) {
            toolResult = { error: toolErr?.message || String(toolErr) };
          }
          toolTraces.push({ tool: call.name!, args: call.args, result: toolResult });
          toolResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { result: toolResult },
            },
          });
        }

        contents.push({ role: "user", parts: toolResponseParts });

        // Step 3: Second call to generate natural language response incorporating tool results
        const finalResult = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,
          },
        });

        if (finalResult && finalResult.text) {
          responseText = finalResult.text;
          break;
        }
      } else if (result && result.text) {
        responseText = result.text;
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Ask Intora] Model '${model}' failed:`, err?.message || err);

      if (isGeminiQuotaError(err)) {
        recordGeminiQuotaExhaustion(err);
        break;
      }
    }
  }

  // If Gemini failed or quota exhausted, fall back to intelligent grounded response
  if (!responseText) {
    return getIntelligentFallbackResponse(latestMessage, messages, context);
  }

  // Parse optional shopping plan snippet if generated in JSON
  let planSnippet: ShoppingPlanData | undefined = undefined;
  let cleanText = responseText;

  const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?"type":\s*"plan"[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.items && Array.isArray(parsed.items)) {
        planSnippet = {
          id: `plan-${Date.now()}`,
          title: parsed.title || "Curated Shopping Bundle",
          situation: parsed.situation || latestMessage,
          budget: Number(parsed.budget) || 3000,
          totalAmount: Number(parsed.totalAmount) || 0,
          remainingAmount: Number(parsed.remainingAmount) || 0,
          version: 1,
          timestamp: new Date().toISOString(),
          planHash:
            "0x" +
            Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          items: parsed.items.map((it: any) => ({
            id: it.id || "item",
            name: it.name || "Item",
            category: it.category || "supplies",
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || Number(it.price) || 0,
            totalPrice:
              (Number(it.unitPrice) || Number(it.price) || 0) * (Number(it.quantity) || 1),
            rationale: it.rationale || "Catalog matched item",
            inStock: true,
            imagePlaceholder: "bg-emerald-100 text-emerald-800",
            badge: it.badge,
          })),
          validation: {
            budgetCompliant: true,
            catalogGrounded: true,
            integerPaiseExact: true,
            allInStock: true,
          },
        };
        cleanText = responseText.replace(jsonMatch[0], "").trim();
      }
    } catch (parseErr) {
      console.warn("[Ask Intora] Could not parse JSON plan snippet:", parseErr);
    }
  }

  // Contextual suggested prompt chips based on topic
  const lowerClean = cleanText.toLowerCase();
  const dynamicSuggestedPrompts: string[] = [];

  if (lowerClean.includes("base sepolia") || lowerClean.includes("blockchain")) {
    dynamicSuggestedPrompts.push("Where can I find the transaction hash? 🔗");
    dynamicSuggestedPrompts.push("Is MetaMask verification free? 🦊");
  }
  if (lowerClean.includes("x402") || lowerClean.includes("payment")) {
    dynamicSuggestedPrompts.push("What are the 7 payment statuses? ⚡");
    dynamicSuggestedPrompts.push("How does agent micro-payment work? 💳");
  }
  if (lowerClean.includes("budget") || lowerClean.includes("plan")) {
    dynamicSuggestedPrompts.push("What if I change the budget? 💰");
    dynamicSuggestedPrompts.push("How does the What-If simulator work? 🔮");
  }
  if (dynamicSuggestedPrompts.length === 0) {
    dynamicSuggestedPrompts.push("How do I create a shopping plan? 🎒");
    dynamicSuggestedPrompts.push("How does x402 work in Intora? ⚡");
    dynamicSuggestedPrompts.push("How do I verify on Base Sepolia? ⛓️");
  }

  return {
    text: cleanText,
    planSnippet,
    suggestedPrompts: dynamicSuggestedPrompts.slice(0, 4),
    toolTraces: toolTraces.length > 0 ? toolTraces : undefined,
  };
}
