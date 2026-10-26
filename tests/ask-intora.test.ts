import assert from "node:assert";
import { describe, it } from "node:test";
import {
  processConciergeChat,
  getIntelligentFallbackResponse,
} from "../lib/concierge-server";
import { assistantTools } from "../lib/assistant-tools";
import { INTORA_KNOWLEDGE } from "../lib/intora-knowledge";

describe("Ask Intora - Conversational Website Assistant Test Suite", () => {
  // Scenario 1: Identity & Capabilities
  it("Scenario 1: 'Hey, what can you help me with?' provides a natural guide introduction", async () => {
    const res = await getIntelligentFallbackResponse("Hey, what can you help me with?", []);
    assert.ok(res.text.includes("Ask Intora"), "Should identify as Ask Intora");
    assert.ok(
      res.text.toLowerCase().includes("shopping plan") ||
      res.text.toLowerCase().includes("budget"),
      "Should mention shopping plans and budgets"
    );
    assert.ok(
      res.text.toLowerCase().includes("base sepolia") ||
      res.text.toLowerCase().includes("blockchain"),
      "Should mention Base Sepolia / blockchain"
    );
    assert.ok(
      res.suggestedPrompts && res.suggestedPrompts.length > 0,
      "Should provide suggested prompts"
    );
  });

  // Scenario 2: Shopping Plan Creation
  it("Scenario 2: 'How do I create a shopping plan?' gives actionable step-by-step guidance", async () => {
    const res = await getIntelligentFallbackResponse("How do I create a shopping plan?", []);
    assert.ok(
      res.text.includes("Live Planner Demo") || res.text.includes("/planner"),
      "Should specify real UI locations"
    );
    assert.ok(
      res.text.includes("₹100") && res.text.includes("₹2,00,000"),
      "Should mention the exact integer rupee budget range"
    );
    assert.ok(
      res.text.toLowerCase().includes("optimize plan") ||
      res.text.toLowerCase().includes("generate intelligent plan"),
      "Should mention actual button names"
    );
  });

  // Scenario 3: Budget Adjustments & What-If
  it("Scenario 3: 'What if I change the budget?' explains knapsack optimizer, Trade-Offs, and What-If", async () => {
    const res = await getIntelligentFallbackResponse("What if I change the budget?", []);
    assert.ok(
      res.text.toLowerCase().includes("knapsack") ||
      res.text.toLowerCase().includes("cheaper alternatives") ||
      res.text.toLowerCase().includes("trade-off"),
      "Should explain alternative swapping"
    );
    assert.ok(
      res.text.includes("What-If Simulator") || res.text.includes("What-If"),
      "Should reference What-If simulator"
    );
    assert.ok(
      res.text.toLowerCase().includes("infeasible") || res.text.toLowerCase().includes("shortfall"),
      "Should explain shortfall handling when budget is exceeded"
    );
  });

  // Scenario 4: Simplified Explanation Follow-Up
  it("Scenario 4: 'Can you explain that more simply?' simplifies technical concepts gracefully", async () => {
    const res = await getIntelligentFallbackResponse("Can you explain that more simply?", []);
    assert.ok(
      res.text.toLowerCase().includes("simple") || res.text.toLowerCase().includes("receipt"),
      "Should use simple plain-language concepts"
    );
    assert.ok(!res.text.includes("0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f"), "Should omit dense hex contract addresses in simplified view");
  });

  // Scenario 5: x402 Protocol in Intora
  it("Scenario 5: 'How does x402 work in Intora?' explains HTTP 402, Base Sepolia USDC, and settlement verification", async () => {
    const res = await getIntelligentFallbackResponse("How does x402 work in Intora?", []);
    assert.ok(res.text.includes("HTTP 402"), "Should explain HTTP 402");
    assert.ok(res.text.includes("0.01") && res.text.includes("USDC"), "Should mention $0.01 USDC pricing");
    assert.ok(res.text.includes("Base Sepolia"), "Should specify Base Sepolia network");
    assert.ok(
      res.text.toLowerCase().includes("eip-3009") || res.text.toLowerCase().includes("authorization"),
      "Should mention EIP-3009 transfer authorization"
    );
    assert.ok(
      res.text.toLowerCase().includes("http 200 alone is never") ||
      res.text.toLowerCase().includes("never considered proof"),
      "Must state that HTTP 200 alone does not prove settlement"
    );
  });

  // Scenario 6: Payment Lifecycle Statuses
  it("Scenario 6: 'How do I check my payment status?' details the 7 payment lifecycle states", async () => {
    const res = await getIntelligentFallbackResponse("How do I check my payment status?", []);
    assert.ok(res.text.includes("Ready"), "Should include Ready status");
    assert.ok(res.text.includes("Payment required"), "Should include Payment required status");
    assert.ok(res.text.includes("Authorizing"), "Should include Authorizing status");
    assert.ok(res.text.includes("Submitting settlement"), "Should include Submitting settlement status");
    assert.ok(res.text.includes("Confirmed"), "Should include Confirmed status");
    assert.ok(res.text.includes("Failed"), "Should include Failed status");
    assert.ok(res.text.includes("Pending verification"), "Should include Pending verification status");
  });

  // Scenario 7: Product Search Error Troubleshooting
  it("Scenario 7: 'Why did my product search fail?' diagnoses timeouts (504), keys (503), and quota (429)", async () => {
    const res = await getIntelligentFallbackResponse("Why did my product search fail?", []);
    assert.ok(
      res.text.includes("504") || res.text.includes("PROVIDER_TIMEOUT") || res.text.includes("Timeout"),
      "Should diagnose 504 ScraperAPI timeouts"
    );
    assert.ok(
      res.text.includes("503") || res.text.includes("SCRAPERAPI_KEY"),
      "Should explain 503 missing key handling"
    );
    assert.ok(
      res.text.includes("429") || res.text.toLowerCase().includes("quota"),
      "Should explain 429 AI quota exhaustion"
    );
    assert.ok(
      res.text.includes("4001") || res.text.toLowerCase().includes("metamask"),
      "Should mention MetaMask rejection error 4001"
    );
  });

  // Scenario 8: Blockchain Verification
  it("Scenario 8: 'How do I verify my plan on the blockchain?' explains MetaMask, Keccak-256, and Base Sepolia", async () => {
    const res = await getIntelligentFallbackResponse("How do I verify my plan on the blockchain?", []);
    assert.ok(
      res.text.includes("ShoppingIntentRegistry") || res.text.includes("0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f"),
      "Should mention the ShoppingIntentRegistry smart contract"
    );
    assert.ok(res.text.includes("Keccak-256"), "Should mention Keccak-256 hash");
    assert.ok(res.text.includes("84532") || res.text.includes("Base Sepolia"), "Should specify Base Sepolia 84532");
    assert.ok(
      res.text.toLowerCase().includes("free") || res.text.toLowerCase().includes("zero real money"),
      "Must clarify it costs free testnet gas only"
    );
    assert.ok(
      res.text.toLowerCase().includes("not place an order") ||
      res.text.toLowerCase().includes("does not charge a credit card"),
      "Must clarify that commitment does not place an order"
    );
  });

  // Scenario 9: Out-of-Scope General Knowledge Question
  it("Scenario 9: Unrelated request receives polite scope clarification", async () => {
    const res = await getIntelligentFallbackResponse("Write a python script for a discord bot", []);
    assert.ok(
      res.text.includes("Ask Intora") &&
      (res.text.toLowerCase().includes("dedicated specifically") ||
       res.text.toLowerCase().includes("cannot assist with")),
      "Should politely decline out-of-scope tasks"
    );
    assert.ok(
      res.text.toLowerCase().includes("shopping plan") ||
      res.text.toLowerCase().includes("base sepolia"),
      "Should offer to help with Intora instead"
    );
  });

  // Scenario 10: Non-Existent Feature Question
  it("Scenario 10: Non-existent feature inquiry clarifies absence honestly", async () => {
    const res = await getIntelligentFallbackResponse("How do I pay with Bitcoin Lightning or order a pizza?", []);
    assert.ok(
      res.text.toLowerCase().includes("does not support") ||
      res.text.toLowerCase().includes("not available"),
      "Should honestly declare non-existent features as unsupported"
    );
    assert.ok(
      res.text.includes("Base Sepolia") && res.text.includes("USDC"),
      "Should state what Intora actually supports"
    );
  });

  // Scenario 11: Context Awareness & Route Grounding
  it("Scenario 11: Recognizes active client route in context", async () => {
    const resPlanner = await getIntelligentFallbackResponse("Hey, who are you?", [], {
      pathname: "/planner",
      hasPlan: true,
      activeBudget: 5000,
    });
    assert.ok(
      resPlanner.text.includes("Full Planner Workspace"),
      "Should acknowledge that the user is currently on /planner"
    );

    const resHistory = await getIntelligentFallbackResponse("Hey, who are you?", [], {
      pathname: "/history",
    });
    assert.ok(
      resHistory.text.includes("Commitment History"),
      "Should acknowledge that the user is currently on /history"
    );
  });

  // Scenario 12: Server-Side Tool Suite Verification
  it("Scenario 12: Server tools execute correctly and safely without hallucination", async () => {
    // Tool 1: get_page_and_feature_guide
    const guideTool = assistantTools.find((t) => t.name === "get_page_and_feature_guide");
    assert.ok(guideTool, "get_page_and_feature_guide tool must exist");
    const guideRes = (await guideTool.run({ topic: "planner" })) as any;
    assert.strictEqual(guideRes.found, true);
    assert.strictEqual(guideRes.type, "page");
    assert.strictEqual(guideRes.page.path, "/planner");

    // Tool 2: search_verified_catalog
    const catalogTool = assistantTools.find((t) => t.name === "search_verified_catalog");
    assert.ok(catalogTool, "search_verified_catalog tool must exist");
    const catalogRes = (await catalogTool.run({ query: "notebook", maxResults: 3 })) as any;
    assert.ok(catalogRes.results.length > 0, "Should find real notebooks");
    assert.strictEqual(catalogRes.results[0].category, "stationery");

    // Tool 3: check_x402_status
    const x402Tool = assistantTools.find((t) => t.name === "check_x402_status");
    assert.ok(x402Tool, "check_x402_status tool must exist");
    const x402Res = (await x402Tool.run({})) as any;
    assert.strictEqual(x402Res.network, "Base Sepolia (eip155:84532)");
    assert.strictEqual(x402Res.researchPriceUsd, "0.01");
    assert.strictEqual(x402Res.spendingCapUsd, "0.05");

    // Tool 4: diagnose_system_error
    const diagTool = assistantTools.find((t) => t.name === "diagnose_system_error");
    assert.ok(diagTool, "diagnose_system_error tool must exist");
    const timeoutRes = (await diagTool.run({ errorIndicator: "PROVIDER_TIMEOUT" })) as any;
    assert.strictEqual(timeoutRes.identified, true);
    assert.strictEqual(timeoutRes.httpStatus, 504);
    assert.ok(timeoutRes.recoverySteps.length > 0);

    const metamaskRes = (await diagTool.run({ errorIndicator: "4001" })) as any;
    assert.strictEqual(metamaskRes.identified, true);
    assert.strictEqual(metamaskRes.code, "WALLET_USER_REJECTED");
  });
});
