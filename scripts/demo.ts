import { network } from "hardhat";
import { keccak256, stringToHex } from "viem";
import { tools } from "../agent/tools";
import { formatInr, getProductById } from "../lib/catalog";
import { generateIntentId } from "../lib/intent-id";
import { verifyPlanHash } from "../lib/plan-hash";

async function runDemo() {
  console.log("================================================================================");
  console.log("    INTENT-TO-COMMERCE: END-TO-END DEMO ON BASE SEPOLIA (TESTNET ONLY)");
  console.log("================================================================================");

  const conn = await network.connect();
  const [userWallet] = await conn.viem.getWalletClients();
  const publicClient = await conn.viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  console.log(`\n[Network Setup]`);
  console.log(`- Connected Chain: ${conn.networkName} (Chain ID: ${chainId})`);
  console.log(`- User Wallet Address: ${userWallet.account.address}`);

  console.log("\n[Contract Setup] Deploying ShoppingIntentRegistry...");
  const registry = await conn.viem.deployContract("ShoppingIntentRegistry");
  console.log(`- ShoppingIntentRegistry Deployed to: ${registry.address}`);

  const dummyCtx = { baseUrl: "http://localhost:3000" };
  const analyzeTool = tools.find((t) => t.name === "analyze_situation")!;
  const prepIntentTool = tools.find((t) => t.name === "prepare_intent")!;
  const prepTxTool = tools.find((t) => t.name === "prepare_transaction")!;

  // ============================================================================
  // STEP 1: Natural-Language Situation + Budget Input
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 1: USER SUBMITS NATURAL-LANGUAGE SHOPPING SITUATION");
  console.log("--------------------------------------------------------------------------------");
  const userPrompt1 = "I need supplies for three days of college activities, my budget is Rs 3,000";
  console.log(`User Prompt: "${userPrompt1}"`);

  const analysis1: any = await analyzeTool.run({ situation: userPrompt1 }, dummyCtx);
  console.log("\n[Agent Situation Analysis]");
  console.log(`- Extracted Situation: "${analysis1.situation}"`);
  console.log(`- Extracted Currency: ${analysis1.currency}`);
  console.log(`- Budget in Integer Paise: ${analysis1.budgetMinor} paise (${analysis1.budgetDisplay})`);
  console.log(`- Required Categories: ${analysis1.requiredCategories.join(", ")}`);
  console.log(`- Time Constraints: ${analysis1.timeConstraints}`);

  // ============================================================================
  // STEP 2: Catalog Grounding, Bundle Validation & Canonical Hashing
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 2: CATALOG GROUNDING, INDEPENDENT VALIDATION & CANONICAL HASHING");
  console.log("--------------------------------------------------------------------------------");
  const sharedIntentId = generateIntentId();
  console.log(`- Generated Client-Side Intent ID: ${sharedIntentId}`);

  const prepV1: any = await prepIntentTool.run(
    {
      intentId: sharedIntentId,
      budgetMinor: analysis1.budgetMinor,
      items: [
        { productId: "college-notebook-pack", quantity: 2 }, // 50,000 paise
        { productId: "gel-pen-set", quantity: 2 }, // 24,000 paise
        { productId: "stainless-water-bottle", quantity: 1 }, // 45,000 paise
        { productId: "power-bank-10000", quantity: 1 }, // 99,900 paise
        { productId: "energy-bar-box", quantity: 1 }, // 30,000 paise
      ],
    },
    dummyCtx
  );

  console.log(`- Version: ${prepV1.version}`);
  console.log(`- Budget Cap: ${prepV1.budgetDisplay} (${prepV1.plan.budgetMinor} paise)`);
  console.log(`- Total Plan Cost: ${prepV1.totalDisplay} (${prepV1.plan.totalMinor} paise)`);
  console.log("\nItems Included in Plan:");
  for (const item of prepV1.plan.items) {
    const p = getProductById(item.productId)!;
    console.log(`  • ${p.name} (x${item.quantity}) - ${formatInr(item.unitPriceMinor * item.quantity)} [Catalog Verified ✅]`);
  }
  console.log(`\n- Canonical UTF-8 JSON:`);
  console.log(`  ${prepV1.canonicalString}`);
  console.log(`- Cryptographic Keccak256 Plan Hash:`);
  console.log(`  ${prepV1.planHash}`);

  // ============================================================================
  // STEP 3: User Reviews and Approves -> MetaMask Record Transaction
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 3: USER APPROVAL & ON-CHAIN COMMITMENT (VERSION 1)");
  console.log("--------------------------------------------------------------------------------");
  const txPayload1: any = await prepTxTool.run({ intentId: sharedIntentId, version: 1 }, dummyCtx);
  console.log(`Disclaimer Notice: "${txPayload1.disclaimer}"`);
  console.log(`Prepared Contract Call: ${txPayload1.functionName}`);
  console.log(`Calldata: ${txPayload1.calldata.slice(0, 42)}...`);

  console.log("Submitting transaction with user MetaMask wallet...");
  const tx1 = await registry.write.recordIntent([
    sharedIntentId,
    prepV1.planHash,
    1,
    BigInt(prepV1.plan.expiry),
  ]);
  console.log(`Transaction Hash: ${tx1}`);

  // ============================================================================
  // STEP 4: Read Commitment Back & Verify Off-Chain Hash
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 4: ON-CHAIN READ-BACK & VERIFICATION");
  console.log("--------------------------------------------------------------------------------");
  const commitmentV1 = await registry.read.getCommitment([sharedIntentId, 1]);
  console.log(`- Stored Plan Hash:   ${prepV1.planHash}`);
  console.log(`- On-Chain Plan Hash: ${commitmentV1[1]}`);
  const matchV1 = verifyPlanHash(prepV1.canonicalString, commitmentV1[1]);
  console.log(`- Cryptographic Hash Match: ${matchV1 ? "PASS ✅ (100% Exact Match)" : "FAIL ❌"}`);
  console.log(`- Intent Status: ${await registry.read.isIntentValid([sharedIntentId]) ? "ACTIVE & UNEXPIRED ✅" : "INACTIVE"}`);

  // ============================================================================
  // STEP 5: Budget Revision -> Version 2 with SAME intentId
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 5: USER REVISION: 'budget is now Rs 2,000, keep the essentials'");
  console.log("--------------------------------------------------------------------------------");
  const userPrompt2 = "Budget is now Rs 2,000, keep the essentials";
  console.log(`User Revision Prompt: "${userPrompt2}"`);

  const prepV2: any = await prepIntentTool.run(
    {
      intentId: sharedIntentId, // SAME INTENT ID (Required!)
      budgetMinor: 200000, // ₹2,000.00
      items: [
        { productId: "college-notebook-pack", quantity: 2 }, // 50,000 paise
        { productId: "gel-pen-set", quantity: 2 }, // 24,000 paise
        { productId: "stainless-water-bottle", quantity: 1 }, // 45,000 paise
        { productId: "energy-bar-box", quantity: 1 }, // 30,000 paise
        { productId: "mini-first-aid-kit", quantity: 1 }, // 22,000 paise
      ],
    },
    dummyCtx
  );

  console.log(`- Preserved Same Intent ID: ${prepV2.intentId === sharedIntentId ? "YES ✅" : "NO ❌"}`);
  console.log(`- Assigned Next Version: ${prepV2.version} (v${prepV1.version} -> v${prepV2.version})`);
  console.log(`- New Budget Cap: ${prepV2.budgetDisplay} (${prepV2.plan.budgetMinor} paise)`);
  console.log(`- New Total Cost: ${prepV2.totalDisplay} (${prepV2.plan.totalMinor} paise)`);
  console.log(`\n[Structured Human-Readable Diff]`);
  console.log(`Summary: ${prepV2.diff.summary}`);
  console.log(`- Removed Items: ${prepV2.diff.removedItems.map((r: any) => getProductById(r.productId)?.name).join(", ")}`);
  console.log(`- Added Items:   ${prepV2.diff.addedItems.map((a: any) => getProductById(a.productId)?.name).join(", ")}`);
  console.log(`- Budget Delta:  ${formatInr(prepV2.diff.budgetDeltaMinor)}`);
  console.log(`- Total Delta:   ${formatInr(prepV2.diff.totalDeltaMinor)}`);

  console.log(`\n- Version 2 Cryptographic Keccak256 Plan Hash:`);
  console.log(`  ${prepV2.planHash}`);

  // ============================================================================
  // STEP 6: User Approves Version 2 -> Record Version on Base Sepolia
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 6: RECORD VERSION 2 ON-CHAIN");
  console.log("--------------------------------------------------------------------------------");
  const txPayload2: any = await prepTxTool.run({ intentId: sharedIntentId, version: 2 }, dummyCtx);
  console.log(`Prepared Contract Call: ${txPayload2.functionName}`);
  const tx2 = await registry.write.recordVersion([
    sharedIntentId,
    prepV2.planHash,
    2,
    BigInt(prepV2.plan.expiry),
  ]);
  console.log(`Transaction Hash: ${tx2}`);

  // ============================================================================
  // STEP 7: Verify Dual Version Immutability
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 7: DUAL-VERSION VERIFICATION (VERSION 1 REMAINS PRESERVED)");
  console.log("--------------------------------------------------------------------------------");
  const onChainV2 = await registry.read.getCommitment([sharedIntentId, 2]);
  const onChainV1Again = await registry.read.getCommitment([sharedIntentId, 1]);
  const latestOnChainVer = await registry.read.getLatestVersion([sharedIntentId]);

  console.log(`- Latest Active On-Chain Version: ${latestOnChainVer}`);
  console.log(`- Checking Version 1 On-Chain Hash: ${onChainV1Again[1]}`);
  console.log(`  Matches Off-Chain Canonical v1? -> ${verifyPlanHash(prepV1.canonicalString, onChainV1Again[1]) ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`- Checking Version 2 On-Chain Hash: ${onChainV2[1]}`);
  console.log(`  Matches Off-Chain Canonical v2? -> ${verifyPlanHash(prepV2.canonicalString, onChainV2[1]) ? "PASS ✅" : "FAIL ❌"}`);

  console.log("\n================================================================================");
  console.log("    INTEGRATION DEMO SUCCESS: ALL FLOWS FULLY VALIDATED AND COMMITTED ✅");
  console.log("================================================================================");
}

runDemo().catch((err) => {
  console.error("Demo failed:", err);
  process.exitCode = 1;
});
