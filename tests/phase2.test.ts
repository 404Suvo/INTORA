import assert from "node:assert";
import { describe, it } from "node:test";

process.env.NODE_ENV = "test";

import { tools } from "../agent/tools";
import { BASE_SEPOLIA_CHAIN_ID } from "../lib/contract-config";
import { generateIntentId } from "../lib/intent-id";
import { getPlanRecord } from "../lib/plan-storage";

describe("Phase 2: Gemini Agent with Controlled Tools", () => {
  const dummyCtx = { baseUrl: "http://localhost:3000" };
  const getTool = (name: string) => {
    const t = tools.find((x) => x.name === name);
    assert.ok(t, `Tool ${name} should exist`);
    return t;
  };

  it("analyze_situation parses situation and converts rupees to integer paise", async () => {
    const tool = getTool("analyze_situation");
    const res: any = await tool.run(
      { situation: "I need supplies for three days of college activities, my budget is Rs 3,000" },
      dummyCtx
    );

    assert.strictEqual(res.currency, "INR");
    assert.strictEqual(res.budgetMinor, 300000); // 3000 * 100 paise
    assert.ok(res.requiredCategories.includes("stationery") || res.requiredCategories.includes("supplies"));
    assert.strictEqual(res.timeConstraints, "3 days");
  });

  it("analyze_situation handles 'under 2000' budget format", async () => {
    const tool = getTool("analyze_situation");
    const res: any = await tool.run(
      { situation: "College study materials under 2000" },
      dummyCtx
    );

    assert.strictEqual(res.budgetMinor, 200000);
  });

  it("search_products returns real catalog records only", async () => {
    const tool = getTool("search_products");
    const res: any = await tool.run({ query: "notebook" }, dummyCtx);

    assert.ok(res.count >= 1);
    assert.strictEqual(res.items[0].id, "college-notebook-pack");
    assert.strictEqual(res.items[0].priceMinor, 25000);
    assert.strictEqual(typeof res.items[0].priceMinor, "number");
    assert.strictEqual(Number.isInteger(res.items[0].priceMinor), true);
  });

  it("optimize_bundle prioritizes essential items within budget", async () => {
    const tool = getTool("optimize_bundle");
    const res: any = await tool.run({ budgetMinor: 300000 }, dummyCtx);

    assert.strictEqual(res.withinBudget, true);
    assert.ok(res.totalMinor <= 300000);
    assert.ok(res.itemCount >= 2);
    // Verifies all item prices and total are integers
    for (const item of res.items) {
      assert.strictEqual(Number.isInteger(item.unitPriceMinor), true);
      assert.strictEqual(Number.isInteger(item.subtotalMinor), true);
    }
  });

  it("verify_plan flags invalid plans and price mismatches", async () => {
    const tool = getTool("verify_plan");
    const res: any = await tool.run(
      {
        plan: {
          schemaVersion: "1.0.0",
          intentId: generateIntentId(),
          version: 1,
          currency: "INR",
          budgetMinor: 10000,
          items: [{ productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 99 }],
          totalMinor: 99,
          expiry: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      dummyCtx
    );

    assert.strictEqual(res.valid, false); // 25000 > 10000 budget cap
    assert.strictEqual(res.priceMismatches.length, 1);
    assert.strictEqual(res.priceMismatches[0].aiPriceMinor, 99);
    assert.strictEqual(res.priceMismatches[0].catalogPriceMinor, 25000);
  });

  it("prepare_intent creates version 1 and produces version 2 with identical intentId upon revision", async () => {
    const tool = getTool("prepare_intent");
    const sharedIntentId = generateIntentId();

    // Step 1: Version 1 with budget ₹3,000 (300,000 paise)
    const v1Res: any = await tool.run(
      {
        intentId: sharedIntentId,
        budgetMinor: 300000,
        items: [
          { productId: "college-notebook-pack", quantity: 2 }, // 50,000
          { productId: "gel-pen-set", quantity: 2 }, // 24,000
          { productId: "stainless-water-bottle", quantity: 1 }, // 45,000
          { productId: "power-bank-10000", quantity: 1 }, // 99,900
        ],
      },
      dummyCtx
    );

    assert.strictEqual(v1Res.success, true);
    assert.strictEqual(v1Res.version, 1);
    assert.strictEqual(v1Res.intentId, sharedIntentId.toLowerCase());
    assert.strictEqual(v1Res.isRevision, false);
    assert.ok(v1Res.planHash.startsWith("0x"));

    const storedV1 = getPlanRecord(sharedIntentId, 1);
    assert.ok(storedV1);
    assert.strictEqual(storedV1?.planHash, v1Res.planHash);

    // Step 2: Version 2 revision with budget ₹2,000 (200,000 paise) - power bank removed to fit budget
    const v2Res: any = await tool.run(
      {
        intentId: sharedIntentId, // SAME INTENT ID
        budgetMinor: 200000,
        items: [
          { productId: "college-notebook-pack", quantity: 2 },
          { productId: "gel-pen-set", quantity: 2 },
          { productId: "stainless-water-bottle", quantity: 1 },
          { productId: "energy-bar-box", quantity: 1 }, // 30,000
        ],
      },
      dummyCtx
    );

    assert.strictEqual(v2Res.success, true);
    assert.strictEqual(v2Res.version, 2);
    assert.strictEqual(v2Res.intentId, sharedIntentId.toLowerCase());
    assert.strictEqual(v2Res.isRevision, true);
    assert.ok(v2Res.diff);
    assert.strictEqual(v2Res.diff.fromVersion, 1);
    assert.strictEqual(v2Res.diff.toVersion, 2);
    assert.strictEqual(v2Res.diff.budgetDeltaMinor, -100000);
    assert.ok(v2Res.diff.removedItems.some((r: any) => r.productId === "power-bank-10000"));
    assert.ok(v2Res.diff.addedItems.some((a: any) => a.productId === "energy-bar-box"));

    // Verify Version 1 remains intact and readable in storage
    const recheckedV1 = getPlanRecord(sharedIntentId, 1);
    const recheckedV2 = getPlanRecord(sharedIntentId, 2);
    assert.ok(recheckedV1);
    assert.ok(recheckedV2);
    assert.strictEqual(recheckedV1?.planHash, v1Res.planHash);
    assert.strictEqual(recheckedV2?.planHash, v2Res.planHash);
    assert.notStrictEqual(recheckedV1?.planHash, recheckedV2?.planHash);
  });

  it("prepare_transaction generates calldata and does NOT sign or send (Hard Rules 2 & 6)", async () => {
    const prepIntentTool = getTool("prepare_intent");
    const prepTxTool = getTool("prepare_transaction");
    const intentId = generateIntentId();

    await prepIntentTool.run(
      {
        intentId,
        budgetMinor: 100000,
        items: [{ productId: "college-notebook-pack", quantity: 1 }],
      },
      dummyCtx
    );

    // Call prepare_transaction for Version 1
    const txV1: any = await prepTxTool.run({ intentId, version: 1 }, dummyCtx);
    assert.strictEqual(txV1.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.strictEqual(txV1.functionName, "recordIntent");
    assert.ok(txV1.calldata.startsWith("0x"));
    assert.strictEqual(txV1.value, "0");
    assert.ok(txV1.disclaimer.includes("commitment"));

    // Prepare version 2
    await prepIntentTool.run(
      {
        intentId,
        budgetMinor: 100000,
        items: [{ productId: "gel-pen-set", quantity: 1 }],
      },
      dummyCtx
    );

    // Call prepare_transaction for Version 2
    const txV2: any = await prepTxTool.run({ intentId, version: 2 }, dummyCtx);
    assert.strictEqual(txV2.functionName, "recordVersion");
    assert.ok(txV2.calldata.startsWith("0x"));
  });

  it("read_intent retrieves stored plan versions and returns hash match status", async () => {
    const prepIntentTool = getTool("prepare_intent");
    const readIntentTool = getTool("read_intent");
    const intentId = generateIntentId();

    await prepIntentTool.run(
      {
        intentId,
        budgetMinor: 100000,
        items: [{ productId: "college-notebook-pack", quantity: 1 }],
      },
      dummyCtx
    );

    const readRes: any = await readIntentTool.run({ intentId, version: 1 }, dummyCtx);
    assert.strictEqual(readRes.intentId, intentId.toLowerCase());
    assert.strictEqual(readRes.versionQueried, 1);
    assert.ok(readRes.offChainStored);
    assert.strictEqual(readRes.allKnownVersions.length, 1);
  });
});
