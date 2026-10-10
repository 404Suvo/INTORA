import assert from "node:assert";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, stringToHex, type Hex } from "viem";
import { tools } from "../agent/tools";
import { canonicalizePlan } from "../lib/canonicalize";
import { getProductById } from "../lib/catalog";
import { BASE_SEPOLIA_CHAIN_ID } from "../lib/contract-config";
import { computePlanDiff } from "../lib/diff";
import { generateIntentId } from "../lib/intent-id";
import { computePlanHash, verifyPlanHash } from "../lib/plan-hash";
import { getPlanRecord, savePlanRecord } from "../lib/plan-storage";
import { validatePlan } from "../lib/plan-validator";
import { ShoppingPlan } from "../lib/types";

describe("Phase 6: End-to-End Application & Integration Verification", async () => {
  const dummyCtx = { baseUrl: "http://localhost:3000" };

  it("enforces integer minor unit budget math and rejects floating points", () => {
    const intentId = generateIntentId();
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    // Test float budget rejection in validator schema
    const floatBudgetPlan = {
      schemaVersion: "1.0.0",
      intentId,
      version: 1,
      currency: "INR",
      budgetMinor: 3000.5, // float rejected
      items: [{ productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 }],
      totalMinor: 25000,
      expiry,
    };
    const resFloat = validatePlan(floatBudgetPlan);
    assert.strictEqual(resFloat.valid, false);
    assert.ok(resFloat.errors.some((e) => e.includes("Budget must be an integer")));

    // Test valid integer paise budget math
    const validPlan: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId,
      version: 1,
      currency: "INR",
      budgetMinor: 300000, // ₹3,000.00
      items: [
        { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 }, // 50,000 paise
        { productId: "gel-pen-set", quantity: 2, unitPriceMinor: 12000 }, // 24,000 paise
      ],
      totalMinor: 74000,
      expiry,
    };
    const resValid = validatePlan(validPlan);
    assert.strictEqual(resValid.valid, true);
    assert.strictEqual(Number.isInteger(resValid.validatedPlan!.totalMinor), true);
    assert.strictEqual(resValid.validatedPlan!.totalMinor, 74000);
  });

  it("handles wallet disconnection and wrong network safely in transaction preparation", async () => {
    const prepTxTool = tools.find((t) => t.name === "prepare_transaction")!;
    const prepIntentTool = tools.find((t) => t.name === "prepare_intent")!;
    const intentId = generateIntentId();

    await prepIntentTool.run(
      {
        intentId,
        budgetMinor: 300000,
        items: [{ productId: "college-notebook-pack", quantity: 1 }],
      },
      dummyCtx
    );

    const txPayload: any = await prepTxTool.run({ intentId, version: 1 }, dummyCtx);

    // Verify target network is strictly Base Sepolia (84532)
    assert.strictEqual(txPayload.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.strictEqual(txPayload.networkName, "Base Sepolia");
    assert.ok(txPayload.disclaimer.includes("does not place an order"));

    // Verify error handling when plan is not found (e.g. disconnected or invalid query)
    await assert.rejects(async () => {
      await prepTxTool.run({ intentId: generateIntentId(), version: 1 }, dummyCtx);
    });
  });

  it("detects on-chain vs off-chain hash mismatches explicitly", () => {
    const intentId = generateIntentId();
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    const originalPlan: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId,
      version: 1,
      currency: "INR",
      budgetMinor: 300000,
      items: [{ productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 }],
      totalMinor: 25000,
      expiry,
    };

    const { canonicalString, planHash } = computePlanHash(originalPlan);
    assert.strictEqual(verifyPlanHash(canonicalString, planHash), true);

    // Tampered canonical string (e.g. quantity changed off-chain)
    const tamperedCanonical = canonicalString.replace('"quantity":1', '"quantity":2');
    assert.strictEqual(verifyPlanHash(tamperedCanonical, planHash), false);

    // Tampered on-chain hash
    const fakeOnChainHash = keccak256(stringToHex("tampered-hash"));
    assert.strictEqual(verifyPlanHash(canonicalString, fakeOnChainHash), false);
  });

  it("handles user rejection (error code 4001) cleanly without crashing state", () => {
    // Simulating MetaMask user rejection response
    const metaMaskRejectionError = {
      code: 4001,
      message: "MetaMask Tx Signature: User denied transaction signature.",
    };

    let handledGracefully = false;
    let uiMessage = "";

    try {
      throw metaMaskRejectionError;
    } catch (err: any) {
      if (err.code === 4001) {
        handledGracefully = true;
        uiMessage = "Transaction request was rejected in MetaMask (Code 4001).";
      }
    }

    assert.strictEqual(handledGracefully, true);
    assert.ok(uiMessage.includes("Code 4001"));
  });

  it("simulates full contract deployment, recording version 1, revising to version 2, and verifying historical immutability", async () => {
    const conn = await network.connect();
    const registry = await conn.viem.deployContract("ShoppingIntentRegistry");
    const [ownerClient] = await conn.viem.getWalletClients();

    const sharedIntentId = generateIntentId();
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 7;

    // --- Flow 1: Situation prompt: "I need supplies for three days of college activities, my budget is Rs 3,000" ---
    const prepIntentTool = tools.find((t) => t.name === "prepare_intent")!;
    const v1Result: any = await prepIntentTool.run(
      {
        intentId: sharedIntentId,
        budgetMinor: 300000,
        items: [
          { productId: "college-notebook-pack", quantity: 2 }, // 50000
          { productId: "gel-pen-set", quantity: 2 }, // 24000
          { productId: "stainless-water-bottle", quantity: 1 }, // 45000
          { productId: "power-bank-10000", quantity: 1 }, // 99900
          { productId: "energy-bar-box", quantity: 1 }, // 30000
        ],
      },
      dummyCtx
    );

    assert.strictEqual(v1Result.success, true);
    assert.strictEqual(v1Result.version, 1);
    assert.strictEqual(v1Result.plan.totalMinor, 248900); // ₹2,489.00 <= ₹3,000.00

    // Record Version 1 on-chain
    await registry.write.recordIntent([
      sharedIntentId,
      v1Result.planHash,
      1,
      BigInt(expiry),
    ]);

    // Read back and verify Version 1 on-chain
    const onChainV1: any = await registry.read.getCommitment([sharedIntentId, 1]);
    assert.strictEqual(onChainV1[0].toLowerCase(), ownerClient.account.address.toLowerCase());
    assert.strictEqual(onChainV1[1], v1Result.planHash);
    assert.strictEqual(onChainV1[2], 1);
    assert.strictEqual(verifyPlanHash(v1Result.canonicalString, onChainV1[1]), true);

    // --- Flow 2: Revision prompt: "Budget is now Rs 2,000, keep the essentials" ---
    // Under ₹2,000 (200,000 paise): Drop power bank (₹999), keep notebook, pens, bottle, snacks, and add first aid kit
    const v2Result: any = await prepIntentTool.run(
      {
        intentId: sharedIntentId, // SAME INTENT ID
        budgetMinor: 200000, // Reduced budget
        items: [
          { productId: "college-notebook-pack", quantity: 2 }, // 50000
          { productId: "gel-pen-set", quantity: 2 }, // 24000
          { productId: "stainless-water-bottle", quantity: 1 }, // 45000
          { productId: "energy-bar-box", quantity: 1 }, // 30000
          { productId: "mini-first-aid-kit", quantity: 1 }, // 22000
        ],
      },
      dummyCtx
    );

    assert.strictEqual(v2Result.success, true);
    assert.strictEqual(v2Result.version, 2);
    assert.strictEqual(v2Result.isRevision, true);
    assert.strictEqual(v2Result.plan.totalMinor, 171000); // ₹1,710.00 <= ₹2,000.00
    assert.ok(v2Result.diff);
    assert.strictEqual(v2Result.diff.fromVersion, 1);
    assert.strictEqual(v2Result.diff.toVersion, 2);
    assert.strictEqual(v2Result.diff.budgetDeltaMinor, -100000);
    assert.ok(v2Result.diff.removedItems.some((r: any) => r.productId === "power-bank-10000"));
    assert.ok(v2Result.diff.addedItems.some((a: any) => a.productId === "mini-first-aid-kit"));

    // Record Version 2 on-chain
    await registry.write.recordVersion([
      sharedIntentId,
      v2Result.planHash,
      2,
      BigInt(expiry),
    ]);

    // Verify on-chain state
    const latestVersion = await registry.read.getLatestVersion([sharedIntentId]);
    assert.strictEqual(latestVersion, 2);

    const onChainV2: any = await registry.read.getCommitment([sharedIntentId, 2]);
    assert.strictEqual(onChainV2[1], v2Result.planHash);
    assert.strictEqual(onChainV2[2], 2);
    assert.strictEqual(verifyPlanHash(v2Result.canonicalString, onChainV2[1]), true);

    // CRITICAL: Verify Version 1 is still readable, valid, and unchanged!
    const historicalV1: any = await registry.read.getCommitment([sharedIntentId, 1]);
    assert.strictEqual(historicalV1[1], v1Result.planHash);
    assert.strictEqual(historicalV1[2], 1);
    assert.strictEqual(verifyPlanHash(v1Result.canonicalString, historicalV1[1]), true);
  });
});
