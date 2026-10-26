/**
 * INTORA AUTHORITATIVE WEBSITE KNOWLEDGE BASE & SOURCE OF TRUTH
 *
 * Grounded in the actual codebase implementation:
 * - Next.js App Router pages (/ , /planner , /history , /demo)
 * - Base Sepolia Smart Contracts & MetaMask commitments
 * - x402 HTTP micro-payments for deep product intelligence
 * - Knapsack budget optimizer with integer paise math (₹100 to ₹2,00,000)
 * - ScraperAPI Amazon India search & fallback verified catalog
 * - Trade-off engine & What-If multi-version simulator
 */

export interface WebsitePageInfo {
  path: string;
  name: string;
  purpose: string;
  keyFeatures: string[];
  controls: string[];
}

export interface WebsiteFeatureInfo {
  id: string;
  name: string;
  oneSentenceSummary: string;
  location: string;
  steps: string[];
  expectedResult: string;
  limitationsAndErrors: string[];
}

export const INTORA_KNOWLEDGE = {
  identity: {
    name: "Ask Intora",
    role: "Built-in AI guide and website assistant for Intora",
    corePrinciple: "ChatGPT-like conversational quality with strict, specialized expertise limited to the Intora website and its features.",
    mission: "Help users understand, navigate, troubleshoot, and use the Intora website to create budget-grounded shopping plans, simulate what-if scenarios, explore x402 paid research, and verify immutable commitments on Base Sepolia.",
  },

  platform: {
    description: "Intora is an intent-to-commerce platform that transforms natural-language situations (e.g., college fests, monsoon treks, hostel setup) and rupee budgets into verified, grounded shopping bundles, and records immutable commitments on the Base Sepolia blockchain via MetaMask.",
    currency: "INR (Indian Rupee, ₹)",
    budgetUnit: "Integer paise (1 INR = 100 paise). Floating-point paise are strictly rejected.",
    minBudgetInr: 100, // ₹100
    maxBudgetInr: 200000, // ₹2,00,000
    blockchain: {
      network: "Base Sepolia Testnet",
      chainId: 84532,
      rpc: "https://sepolia.base.org",
      explorerBase: "https://sepolia.basescan.org",
      contractName: "ShoppingIntentRegistry",
      contractAddress: "0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f",
      hashAlgorithm: "Keccak-256 deterministic hash of canonicalized JSON plan",
      cost: "Free testnet gas only (requires zero real money)",
      commitmentNature: "Records a cryptographic proof of the agreed items, quantities, and pricing between buyer and agent. It DOES NOT place an order with Amazon/merchants, and DOES NOT transfer real funds to sellers.",
    },
    x402: {
      protocol: "x402 HTTP Payment Required standard (EIP-3009 TransferWithAuthorization)",
      network: "Base Sepolia (eip155:84532)",
      token: "USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)",
      pricePerQuery: "$0.01 USDC (10,000 atomic units)",
      clientSpendCap: "$0.05 USDC",
      facilitatorUrl: "https://x402.org/facilitator",
      protectedEndpoint: "/api/research/product",
      purpose: "Unlocks verified deep product intelligence (cross-platform price comparisons, counterfeit risk audits, seller reliability ratings) via autonomous agent micro-payments.",
      statuses: [
        "Ready - Initial state before payment is initiated",
        "Payment required - HTTP 402 received with payment parameters",
        "Authorizing - EIP-3009 typed authorization generated and signed by agent wallet",
        "Submitting settlement - Payload sent to x402 facilitator",
        "Confirmed - Payment settled on Base Sepolia with confirmed transaction hash",
        "Failed - Payment failed (e.g., insufficient testnet balance, network timeout, spend limit exceeded)",
        "Pending verification - Transaction submitted, awaiting on-chain block inclusion",
      ],
      goldenRule: "HTTP 200 alone is NEVER treated as proof of settlement. Valid settlement telemetry with a verified Basescan transaction hash is required.",
    },
  },

  pages: [
    {
      path: "/",
      name: "Editorial Landing Page",
      purpose: "Introduction to Intora, interactive live planner demo, ecosystem trust strip, use cases, stats, and FAQ.",
      keyFeatures: [
        "Sticky Navbar with 4-column mega-menu and MetaMask wallet connect button",
        "Hero section with natural-language prompt bar, situation chips, and budget slider (₹100 to ₹2,00,000)",
        "Trust Strip showcasing Base Sepolia, ScraperAPI, Google Gemini, and x402",
        "How It Works 3-step editorial guide (Intent -> Budget-Grounded Plan -> Base Sepolia Verification)",
        "Live Planner Demo: Centerpiece interactive bundle planner with instant optimization, quantity adjustments, and trade-off previews",
        "Blockchain Verification section: Interactive timeline (v1-v3), Keccak-256 hash explorer, and diff viewer",
        "Use Cases Bento: Preset scenarios (College Fest, Monsoon Trek, Hostel Setup, Diwali Party)",
        "Stats Grid and FAQ accordion",
        "Ask Intora floating assistant button",
        "Transaction Approval Modal: MetaMask simulation for on-chain commitment recording",
      ],
      controls: [
        "'Start Planning' button in Hero (scrolls directly to Live Demo)",
        "Situation preset chips (College Fest ₹3,000, Monsoon Trek ₹4,500, etc.)",
        "Budget slider (adjusts from ₹100 to ₹2,00,000)",
        "'Optimize Plan' button in Live Demo",
        "'Approve Plan & Record on Chain' button in Live Demo",
        "'Deep Product Research (x402)' button in Live Demo",
        "'Edit in Full Planner' button (navigates to /planner)",
        "'Connect Wallet' button in Navbar",
      ],
    },
    {
      path: "/planner",
      name: "Full Planner Workspace",
      purpose: "Advanced multi-version shopping plan workspace with What-If scenario simulations, version timeline, trade-offs, and custom item additions.",
      keyFeatures: [
        "Situation Prompt input and Preset situation pills",
        "Budget input field enforcing min ₹100 and max ₹2,00,000 integer paise",
        "Loading progress bar with live elapsed counter and request abort support",
        "Structured error banners with retry capability",
        "Editable product bundle: adjust quantities (+ / -), delete items, view in-stock badges and rationale",
        "Add Product Modal: search verified catalog or Amazon India live inventory",
        "Trade-Off Comparison Modal: swap items for cost-saver or premium alternatives",
        "What-If Simulator Panel: simulate scenario prompts (e.g. 'budget cut by 20%', 'plan for 50 guests')",
        "Scenario Timeline: visual tree of historical plan versions (v1, v2, ...)",
        "Version Comparison Modal: side-by-side diff comparing added, removed, and modified items",
        "Deterministic Keccak-256 Plan Hash display with one-click copy",
        "Record Commitment on Base Sepolia button with MetaMask transaction popup",
      ],
      controls: [
        "'Generate Intelligent Plan' / 'Re-optimize Plan' button",
        "'Add Product' button (+ icon) opening AddProductModal",
        "'Trade-Offs' button on product cards opening TradeOffComparisonModal",
        "Quantity counter buttons (+ / - / Trash)",
        "'Simulate Scenario' button in What-If Simulator panel",
        "'Compare Versions' button opening VersionComparisonModal",
        "'Record Commitment on Base Sepolia' button",
        "Copy Plan Hash button",
      ],
    },
    {
      path: "/history",
      name: "Commitment History",
      purpose: "Public audit trail of all on-chain plan commitments recorded on Base Sepolia.",
      keyFeatures: [
        "Chronological list of committed plan versions",
        "Transaction hash display with direct links to Base Sepolia Basescan explorer",
        "Plan version numbers, intent IDs, and commitment timestamps",
        "Search bar to filter by intent ID or txHash",
        "Status filters (Confirmed, Pending)",
        "One-click copy for transaction hashes and plan hashes",
      ],
      controls: [
        "Search input",
        "Status filter dropdown",
        "External link buttons to Basescan",
        "Copy txHash buttons",
        "'Back to Planner' navigation link",
      ],
    },
    {
      path: "/demo",
      name: "3D Canvas / Dotted Surface Demo",
      purpose: "Interactive Three.js visual demonstration of Intora's dynamic particle grid.",
      keyFeatures: [
        "Full-screen 3D dotted surface canvas with wave motion and particle vertex colors",
      ],
      controls: [
        "Interactive mouse hover / rotation",
      ],
    },
  ],

  features: [
    {
      id: "create_plan",
      name: "Create a Shopping Plan",
      oneSentenceSummary: "Generates an AI-curated shopping bundle grounded in real catalog inventory strictly within your rupee budget.",
      location: "Landing page Hero / Live Demo ('#demo'), or the Full Planner page at '/planner'.",
      steps: [
        "Navigate to the Live Demo on the home page or open the Full Planner at '/planner'.",
        "Type your situation or event (e.g., '3-day college fest for 40 participants' or 'weekend camping trip').",
        "Specify your budget ceiling in Rupees (minimum ₹100, maximum ₹2,00,000).",
        "Click 'Optimize Plan' (on the home page) or 'Generate Intelligent Plan' (on the Full Planner).",
        "Review the curated items, unit prices, total cost, and remaining budget buffer.",
      ],
      expectedResult: "A verified shopping plan displaying catalog-matched items, quantities, rationale, exact total cost in ₹, and a deterministic Keccak-256 plan hash.",
      limitationsAndErrors: [
        "Budgets below ₹100 or above ₹2,00,000 are rejected with an error.",
        "If essential requirements alone exceed the budget, the plan is marked infeasible with a shortfall warning.",
        "ScraperAPI network timeouts (504) can occur during peak Amazon traffic; you can retry or rely on the local catalog.",
      ],
    },
    {
      id: "what_if_simulator",
      name: "What-If Shopping Simulator",
      oneSentenceSummary: "Simulates hypothetical scenario changes (budget cuts, guest scaling, preference adjustments) creating clean versioned plan branches.",
      location: "Right-hand sidebar of the Full Planner page ('/planner').",
      steps: [
        "Ensure you have an active plan generated in '/planner'.",
        "Scroll to the 'What-If Simulator' panel on the right side.",
        "Type a scenario prompt (e.g., 'Cut budget by 20%', 'Scale for 50 people instead of 30', or 'Switch to eco-friendly alternatives').",
        "Click 'Simulate Scenario'.",
        "Inspect the new version created in the Scenario Timeline and review the side-by-side diff of added, removed, or modified items.",
      ],
      expectedResult: "A newly created plan version (e.g., Version 2) linked to its parent version, preserving unchanged requirements while calculating exact rupee savings or additions.",
      limitationsAndErrors: [
        "Vague prompts like 'make it better' will trigger an ambiguity clarification prompt asking for specific guidance.",
        "Original snapshots are never overwritten; every simulation creates a non-destructive new version.",
      ],
    },
    {
      id: "trade_off_engine",
      name: "Trade-Off Comparison Engine",
      oneSentenceSummary: "Evaluates alternatives for plan items, highlighting cost-saver or premium options with value scores.",
      location: "Product cards in the Full Planner ('/planner') and Live Demo.",
      steps: [
        "Look for an item card displaying the 'Trade-Offs' or 'Alternatives' badge.",
        "Click the 'Trade-Offs' button to open the Trade-Off Comparison Modal.",
        "Compare the current item with Cost-Saver, Premium, and Balanced alternatives across price, rating, and durability.",
        "Select your preferred alternative and click 'Apply Alternative' to instantly recalculate the plan total.",
      ],
      expectedResult: "The chosen alternative replaces the original SKU and the plan total and remaining buffer update automatically.",
      limitationsAndErrors: [
        "Not all products have viable alternatives in the catalog.",
        "Applying a premium alternative that exceeds the remaining buffer will flag the plan as non-compliant.",
      ],
    },
    {
      id: "x402_product_research",
      name: "x402 Paid Product Research",
      oneSentenceSummary: "Executes an autonomous HTTP 402 micro-payment ($0.01 USDC on Base Sepolia) to unlock verified seller and pricing intelligence.",
      location: "Click 'Deep Product Research (x402)' in Live Demo or Product Bundle Editor.",
      steps: [
        "Click the 'Deep Product Research (x402)' button or search icon.",
        "The X402PaymentModal opens showing the search query and $0.01 USDC quote.",
        "Click 'Execute Paid Research ($0.01 USDC)'.",
        "The agent signs an EIP-3009 authorization and submits it to the x402 facilitator.",
        "Once confirmed, view the Basescan explorer link and deep intelligence analysis (counterfeit audit, price history, seller score).",
      ],
      expectedResult: "Status changes from 'Ready' -> 'Payment required' -> 'Authorizing' -> 'Submitting settlement' -> 'Confirmed', displaying verified research telemetry and a Basescan tx link.",
      limitationsAndErrors: [
        "Requires the agent wallet to have testnet USDC on Base Sepolia.",
        "Enforces a strict $0.05 spend limit per request to prevent unexpected drain.",
        "HTTP 200 alone is never considered proof; confirmation requires the verified PAYMENT-RESPONSE header.",
      ],
    },
    {
      id: "blockchain_verification",
      name: "Base Sepolia Blockchain Verification",
      oneSentenceSummary: "Records an immutable cryptographic Keccak-256 commitment of your approved shopping plan on Base Sepolia.",
      location: "Click 'Approve Plan & Record on Chain' in Live Demo or 'Record Commitment on Base Sepolia' in '/planner'.",
      steps: [
        "Ensure your plan items, quantities, and budget are finalized.",
        "Click 'Approve Plan & Record on Chain' or 'Record Commitment on Base Sepolia'.",
        "The Transaction Approval Modal opens, displaying the plan summary, version number, and Keccak-256 hash.",
        "Connect your MetaMask wallet if not already connected.",
        "Verify that your network is set to Base Sepolia (Chain ID 84532).",
        "Click 'Confirm Commitment' and approve the transaction in MetaMask.",
        "Receive the on-chain transaction hash and click the Basescan link to view the permanent proof.",
      ],
      expectedResult: "An immutable on-chain record stored in the ShoppingIntentRegistry smart contract (0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f) on Base Sepolia, visible on Basescan and in '/history'.",
      limitationsAndErrors: [
        "Zero real money is charged — this uses free Base Sepolia testnet gas.",
        "This records a proof of agreed commitment; it DOES NOT place an order with merchants.",
        "If the user rejects the MetaMask popup (error code 4001), Intora handles it safely without crashing.",
      ],
    },
  ],

  errors: [
    {
      code: "PROVIDER_TIMEOUT",
      httpStatus: 504,
      cause: "ScraperAPI connection timed out (>20s) while scraping live Amazon India results due to high upstream latency.",
      recoverySteps: [
        "Click 'Retry Search' or re-submit the plan prompt.",
        "If live Amazon search continues to time out, the system will offer verified items from Intora's internal product catalog.",
        "Check /api/health to confirm ScraperAPI configuration status.",
      ],
    },
    {
      code: "SCRAPERAPI_KEY_MISSING",
      httpStatus: 503,
      cause: "SCRAPERAPI_KEY is not configured in backend environment variables.",
      recoverySteps: [
        "For local development, add SCRAPERAPI_KEY=... to your .env file and restart the development server.",
        "On production, set SCRAPERAPI_KEY in Vercel environment variables.",
        "Intora automatically falls back to its curated in-memory catalog (50+ items) so planning remains functional.",
      ],
    },
    {
      code: "AI_QUOTA_EXHAUSTED",
      httpStatus: 429,
      cause: "Google Gemini API project rate limit or free-tier quota has been temporarily exhausted.",
      recoverySteps: [
        "Intora's circuit breaker automatically prevents wasteful repeated calls and displays cooldown countdown.",
        "Planning continues seamlessly using deterministic catalog optimization and rule-based What-If simulation.",
        "Wait for the cooldown period or upgrade to a paid Gemini API tier with higher RPM.",
      ],
    },
    {
      code: "WALLET_USER_REJECTED",
      codeNumber: 4001,
      cause: "User clicked 'Reject' or dismissed the MetaMask transaction signing request.",
      recoverySteps: [
        "No funds were lost and your plan remains intact in your workspace.",
        "When ready, click 'Record Commitment on Base Sepolia' again and approve the transaction in MetaMask.",
      ],
    },
    {
      code: "WALLET_WRONG_NETWORK",
      cause: "MetaMask is connected to an unsupported blockchain network instead of Base Sepolia.",
      recoverySteps: [
        "Click the network switch prompt in Intora or manually switch MetaMask to 'Base Sepolia' (Chain ID 84532).",
        "If Base Sepolia is not in your MetaMask, Intora will prompt you to add it with RPC URL https://sepolia.base.org.",
      ],
    },
    {
      code: "BUDGET_OVERRUN_INFEASIBLE",
      cause: "The user-specified essential items or minimum quantities cost more than the rupee budget ceiling.",
      recoverySteps: [
        "Increase the budget amount in the budget input field.",
        "Use the Trade-Off Comparison Modal to switch high-priced items to cost-saver alternatives.",
        "Decrease quantities or uncheck items marked as strictly essential.",
      ],
    },
  ],

  scopeBoundaries: {
    inScopeExamples: [
      "What is Intora and how does it work?",
      "How do I create a shopping plan for a college fest?",
      "How does the budget optimizer work?",
      "What does HTTP 402 mean in Intora?",
      "How do I verify my plan on Base Sepolia?",
      "Where can I find my transaction hash?",
      "How does the What-If simulator work?",
      "Why did my product search fail or time out?",
      "How do I check my x402 payment status?",
      "How can I make my current shopping plan cheaper?",
      "What items are in the verified catalog?",
      "How do I compare two plan versions?",
    ],
    outOfScopeExamples: [
      "Write a Python script for a discord bot unrelated to Intora.",
      "Help me with my physics or math homework.",
      "What is the latest world news or sports score?",
      "Write a creative fictional story or blog post unrelated to Intora.",
      "Give me financial investment advice for cryptocurrency trading.",
      "How do I hack MetaMask or steal private keys?",
    ],
    declineMessage:
      "I am Ask Intora, the AI guide dedicated specifically to helping you understand, navigate, and use the Intora website and its features. While I cannot assist with general topics unrelated to Intora, I would be delighted to help you create a shopping plan, simulate what-if scenarios, explore x402 research, or verify commitments on Base Sepolia. How can I help you with Intora today?",
  },
} as const;
