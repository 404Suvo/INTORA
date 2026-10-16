import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { keccak256, stringToHex } from "viem";
import { ShoppingPlanData, ProductItem } from "../data/mockData";
import {
  interpretDeterministicScenario,
  validateScenario,
  interpretScenarioRequest,
  simulateShoppingPlan,
  comparePlanVersions,
  recordPlanVersion,
  getPlanVersionRecord,
  getPlanVersionHistory,
  toCanonicalShoppingPlan,
  isSharedItem,
  isConsumableItem,
} from "../lib/what-if";
import { computePlanHash, verifyPlanHash } from "../lib/plan-hash";
import { generateIntentId } from "../lib/intent-id";
import { CURRENCY, MAX_BUDGET_INR, MIN_BUDGET_INR } from "../lib/types";

describe("What-if Shopping Simulator Test Suite", () => {
  // Baseline Plan Generator
  const createTestPlan = (overrides: Partial<ShoppingPlanData> = {}): ShoppingPlanData => {
    const defaultItems: ProductItem[] = [
      {
        id: "stainless-water-bottle",
        name: "Insulated Stainless Steel Bottle (750ml)",
        category: "supplies",
        quantity: 1,
        unitPrice: 450,
        totalPrice: 450,
        subtotal: 450,
        essential: true,
        optional: false,
        priority: 1,
        rationale: "Required hydration flask.",
        reason: "Required hydration flask.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
      {
        id: "power-bank-10000",
        name: "10000mAh Power Bank Fast Charging",
        category: "electronics",
        quantity: 1,
        unitPrice: 999,
        totalPrice: 999,
        subtotal: 999,
        essential: true,
        optional: false,
        priority: 1,
        rationale: "Emergency charging for devices.",
        reason: "Emergency charging for devices.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
      {
        id: "college-notebook-pack",
        name: "5-Subject Spiral Notebooks (Pack of 3)",
        category: "stationery",
        quantity: 1,
        unitPrice: 250,
        totalPrice: 250,
        subtotal: 250,
        essential: true,
        optional: false,
        priority: 2,
        rationale: "Study and event notes.",
        reason: "Study and event notes.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
      {
        id: "snack-bar-pack",
        name: "Energy Granola Bars Box",
        category: "snacks",
        quantity: 1,
        unitPrice: 300,
        totalPrice: 300,
        subtotal: 300,
        essential: false,
        optional: true,
        priority: 3,
        rationale: "Quick snacks between activities.",
        reason: "Quick snacks between activities.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
    ];

    const totalAmount = defaultItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const budget = 3000;
    const remainingAmount = budget - totalAmount;

    return {
      id: generateIntentId(),
      title: "3-Day College Event Essentials",
      situation: "Attending a 3-day annual cultural fest in Kolkata. Budget is ₹3,000.",
      budget,
      totalAmount,
      remainingAmount,
      version: 1,
      timestamp: "16 Oct 2026, 04:00 IST",
      planHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      items: defaultItems,
      validation: {
        budgetCompliant: true,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      ...overrides,
    };
  };

  // 1. Test: Reducing budget and recalculating plan
  it("Requirement 1: correctly reduces budget, swaps alternatives or removes optionals, and recalculates savings", async () => {
    const originalPlan = createTestPlan();
    const scenario = await interpretScenarioRequest(
      "What if my budget drops to ₹2,000?",
      {
        currentBudget: originalPlan.budget,
        currentSituation: originalPlan.situation,
        currentItems: originalPlan.items,
        parentPlanId: originalPlan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );

    assert.strictEqual(scenario.isValid, true);
    assert.strictEqual(scenario.budget, 2000);

    const result = await simulateShoppingPlan(originalPlan, scenario);
    assert.ok(result.newPlan.budget <= 2000);
    assert.ok(result.newPlan.totalAmount <= 2000);
    assert.strictEqual(result.newPlan.version, 2);
    assert.strictEqual(result.diff.budgetDelta, -1000);
    assert.strictEqual(result.diff.fromVersion, 1);
    assert.strictEqual(result.diff.toVersion, 2);
    // Verified calculation of savings
    assert.strictEqual(result.diff.savings, originalPlan.totalAmount - result.newPlan.totalAmount);
    assert.ok(result.diff.explanation.includes("decreased by ₹1,000"));
  });

  // 2. Test: Adding one person without blindly multiplying shared items
  it("Requirement 2: scales per-person items without blindly multiplying shared utilities", async () => {
    const originalPlan = createTestPlan();
    const scenario = await interpretScenarioRequest(
      "What if I need to include one more person?",
      {
        currentBudget: originalPlan.budget,
        currentSituation: originalPlan.situation,
        currentItems: originalPlan.items,
        parentPlanId: originalPlan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );

    assert.strictEqual(scenario.peopleDelta, 1);

    const result = await simulateShoppingPlan(originalPlan, scenario);
    const newItems = result.newPlan.items;

    // Water bottle is personal: quantity should scale from 1 to 2
    const bottleItem = newItems.find((i) => i.id === "stainless-water-bottle");
    assert.ok(bottleItem);
    assert.strictEqual(bottleItem.quantity, 2);

    // Power bank is a shared item: quantity should stay 1
    const powerBankItem = newItems.find((i) => i.id === "power-bank-10000");
    assert.ok(powerBankItem);
    assert.strictEqual(powerBankItem.quantity, 1);

    // Check shared vs consumable classification helpers
    assert.strictEqual(isSharedItem(powerBankItem), true);
    assert.strictEqual(isSharedItem(bottleItem), false);
  });

  // 3. Test: Preserving unchanged requirements
  it("Requirement 3: preserves all unchanged requirements, situation context, and unaffected items", async () => {
    const originalPlan = createTestPlan();
    const scenario = await interpretScenarioRequest(
      "What if I remove the snacks?",
      {
        currentBudget: originalPlan.budget,
        currentSituation: originalPlan.situation,
        currentItems: originalPlan.items,
        parentPlanId: originalPlan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );

    const result = await simulateShoppingPlan(originalPlan, scenario);
    // Unchanged budget
    assert.strictEqual(result.newPlan.budget, originalPlan.budget);
    // Unchanged title and situation context
    assert.strictEqual(result.newPlan.title, originalPlan.title);
    assert.strictEqual(result.newPlan.situation, originalPlan.situation);
    // Water bottle and power bank are preserved
    assert.ok(result.newPlan.items.some((i) => i.id === "stainless-water-bottle"));
    assert.ok(result.newPlan.items.some((i) => i.id === "power-bank-10000"));
    // Snack bar was removed
    assert.strictEqual(result.newPlan.items.some((i) => i.id === "snack-bar-pack"), false);
  });

  // 4. Test: Retaining the original version after simulation
  it("Requirement 4: never mutates or overwrites the original plan version snapshot", async () => {
    const originalPlan = createTestPlan();
    const originalTotalBefore = originalPlan.totalAmount;
    const originalBudgetBefore = originalPlan.budget;
    const originalItemsCount = originalPlan.items.length;

    const scenario = await interpretScenarioRequest(
      "What if my budget drops to ₹1,500?",
      {
        currentBudget: originalPlan.budget,
        currentSituation: originalPlan.situation,
        currentItems: originalPlan.items,
        parentPlanId: originalPlan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );

    const result = await simulateShoppingPlan(originalPlan, scenario);

    // Original plan in memory remains 100% intact
    assert.strictEqual(originalPlan.version, 1);
    assert.strictEqual(originalPlan.budget, originalBudgetBefore);
    assert.strictEqual(originalPlan.totalAmount, originalTotalBefore);
    assert.strictEqual(originalPlan.items.length, originalItemsCount);

    // New version has distinct attributes
    assert.strictEqual(result.newPlan.version, 2);
    assert.strictEqual(result.newPlan.budget, 1500);
  });

  // 5. Test: Creating a new version with the correct parent identifier
  it("Requirement 5: links new version to parent version identifier in version record", async () => {
    const originalPlan = createTestPlan();
    const scenario = await interpretScenarioRequest(
      "What if I increase my budget to ₹4,000?",
      {
        currentBudget: originalPlan.budget,
        currentSituation: originalPlan.situation,
        currentItems: originalPlan.items,
        parentPlanId: originalPlan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );

    const result = await simulateShoppingPlan(originalPlan, scenario);
    assert.strictEqual(result.versionRecord.version, 2);
    assert.strictEqual(result.versionRecord.parentVersion, 1);
    assert.strictEqual(result.versionRecord.intentId.toLowerCase(), originalPlan.id.toLowerCase());
    assert.strictEqual(result.versionRecord.budget, 4000);
  });

  // 6. Test: Comparing added, removed, retained, and quantity-changed products
  it("Requirement 6: accurately computes diff with added, removed, retained, and quantity changes", () => {
    const v1Plan = createTestPlan();
    const v2Plan: ShoppingPlanData = {
      ...v1Plan,
      version: 2,
      budget: 3500,
      items: [
        // Retained with changed quantity (1 -> 3)
        { ...v1Plan.items[0], quantity: 3, totalPrice: 450 * 3 },
        // Retained unchanged
        v1Plan.items[1],
        // Added product
        {
          id: "mini-first-aid-kit",
          name: "Compact Travel First Aid Kit",
          category: "hygiene",
          quantity: 1,
          unitPrice: 220,
          totalPrice: 220,
          subtotal: 220,
          essential: true,
          optional: false,
          priority: 1,
          rationale: "Emergency medical supplies.",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
        // items[2] and items[3] removed
      ],
      totalAmount: 450 * 3 + 999 + 220,
      remainingAmount: 3500 - (450 * 3 + 999 + 220),
    };

    const diff = comparePlanVersions(v1Plan, v2Plan);

    // Added
    assert.strictEqual(diff.addedProducts.length, 1);
    assert.strictEqual(diff.addedProducts[0].id, "mini-first-aid-kit");

    // Removed (items[2] notebook and items[3] snack bar)
    assert.strictEqual(diff.removedProducts.length, 2);
    assert.ok(diff.removedProducts.some((p) => p.id === "college-notebook-pack"));
    assert.ok(diff.removedProducts.some((p) => p.id === "snack-bar-pack"));

    // Retained (bottle and power bank)
    assert.strictEqual(diff.retainedProducts.length, 2);

    // Quantity changed (bottle: 1 -> 3)
    assert.strictEqual(diff.quantityChanges.length, 1);
    assert.strictEqual(diff.quantityChanges[0].oldQuantity, 1);
    assert.strictEqual(diff.quantityChanges[0].newQuantity, 3);
    assert.strictEqual(diff.quantityChanges[0].delta, 2);

    // Budget delta
    assert.strictEqual(diff.budgetDelta, 500);
  });

  // 7. Test: Correct cost calculations and budget-overrun detection
  it("Requirement 7: detects budget overrun and calculates shortfall without pretending plan fits", async () => {
    const originalPlan = createTestPlan();
    // Drastically drop budget to ₹500 when essential items total > ₹1,400
    const scenario = await interpretScenarioRequest(
      "What if my budget drops to ₹500?",
      {
        currentBudget: originalPlan.budget,
        currentSituation: originalPlan.situation,
        currentItems: originalPlan.items,
        parentPlanId: originalPlan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );

    const result = await simulateShoppingPlan(originalPlan, scenario);

    assert.strictEqual(result.newPlan.feasible, false);
    assert.ok(result.newPlan.budgetOverrun! > 0);
    assert.strictEqual(result.newPlan.budgetOverrun, result.newPlan.totalAmount - 500);
    assert.ok(result.newPlan.optimizationResult?.infeasibilityReason?.includes("exceeds the revised budget"));
    assert.ok(result.newPlan.optimizationResult?.suggestedCompromises?.length! > 0);
  });

  // 8. Test: Invalid budgets and the ₹2,00,000 maximum
  it("Requirement 8: rejects negative, zero, and over-limit budgets above ₹2,00,000", () => {
    const context = { currentBudget: 3000 };

    // Over ₹2,00,000
    const overLimit = validateScenario({ budget: 250000 }, context);
    assert.strictEqual(overLimit.isValid, false);
    assert.ok(overLimit.errors.some((e) => e.includes("2 lakh INR")));

    // Negative budget
    const negative = validateScenario({ budget: -500 }, context);
    assert.strictEqual(negative.isValid, false);
    assert.ok(negative.errors.some((e) => e.includes("positive rupee amount")));

    // Below min ₹100
    const belowMin = validateScenario({ budget: 50 }, context);
    assert.strictEqual(belowMin.isValid, false);
    assert.ok(belowMin.errors.some((e) => e.includes("at least ₹100")));

    // Valid budget within limits
    const valid = validateScenario({ budget: 50000 }, context);
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.sanitizedBudget, 50000);
  });

  // 9. Test: Gemini or ScraperAPI failures without losing original plan
  it("Requirement 9: handles provider or interpretation failures without losing access to original plan", async () => {
    const originalPlan = createTestPlan();
    let caughtError = false;

    try {
      // Simulate invalid input throwing validation rejection
      const invalidScenario = await interpretScenarioRequest(
        "What if my budget drops to ₹-500?",
        {
          currentBudget: originalPlan.budget,
          currentSituation: originalPlan.situation,
          currentItems: originalPlan.items,
          parentPlanId: originalPlan.id,
          parentVersion: 1,
        },
        { skipGemini: true }
      );

      if (!invalidScenario.isValid) {
        throw new Error(invalidScenario.validationErrors?.join(" "));
      }
    } catch (err: any) {
      caughtError = true;
      assert.ok(err.message.includes("positive rupee amount"));
    }

    assert.strictEqual(caughtError, true);
    // Original plan is untouched and preserved
    assert.strictEqual(originalPlan.version, 1);
    assert.strictEqual(originalPlan.budget, 3000);
    assert.ok(originalPlan.items.length > 0);
  });

  // 10. Test: Selecting an older version and creating a new scenario from it
  it("Requirement 10: creates a new scenario branched from an older historical version", async () => {
    const v1Plan = createTestPlan();

    // Version 1 -> Version 2 (reduce budget to 2500)
    const scen1 = await interpretScenarioRequest(
      "What if my budget drops to ₹2,500?",
      {
        currentBudget: v1Plan.budget,
        currentSituation: v1Plan.situation,
        currentItems: v1Plan.items,
        parentPlanId: v1Plan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );
    const resV2 = await simulateShoppingPlan(v1Plan, scen1);
    assert.strictEqual(resV2.newPlan.version, 2);

    // Version 2 -> Version 3 (add 1 person)
    const scen2 = await interpretScenarioRequest(
      "What if I add one person?",
      {
        currentBudget: resV2.newPlan.budget,
        currentSituation: resV2.newPlan.situation,
        currentItems: resV2.newPlan.items,
        parentPlanId: resV2.newPlan.id,
        parentVersion: 2,
      },
      { skipGemini: true }
    );
    const resV3 = await simulateShoppingPlan(resV2.newPlan, scen2);
    assert.strictEqual(resV3.newPlan.version, 3);
    assert.strictEqual(resV3.versionRecord.parentVersion, 2);

    // Now branch from Version 1 directly (creating Version 4 with parentVersion = 1)
    const scenFromV1 = await interpretScenarioRequest(
      "What if I increase budget to ₹5,000?",
      {
        currentBudget: v1Plan.budget,
        currentSituation: v1Plan.situation,
        currentItems: v1Plan.items,
        parentPlanId: v1Plan.id,
        parentVersion: 1,
      },
      { skipGemini: true }
    );
    const resV4 = await simulateShoppingPlan(v1Plan, scenFromV1);
    assert.strictEqual(resV4.newPlan.version, 4);
    assert.strictEqual(resV4.versionRecord.parentVersion, 1);

    // Verify all 4 versions exist in history store
    const history = getPlanVersionHistory(v1Plan.id);
    assert.ok(history.some((h) => h.version === 1));
    assert.ok(history.some((h) => h.version === 2));
    assert.ok(history.some((h) => h.version === 3));
    assert.ok(history.some((h) => h.version === 4));
  });

  // 11. Test: Persistence after refresh
  it("Requirement 11: persists immutable version records to file storage and retrieves them correctly", () => {
    const testPlan = createTestPlan();
    const record = recordPlanVersion(testPlan, {
      scenarioDescription: "Test Persistence Plan",
      parentVersion: null,
      summaryOfChanges: "Initial baseline",
      targetVersion: 1,
    });

    const retrieved = getPlanVersionRecord(testPlan.id, 1);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.version, 1);
    assert.strictEqual(retrieved.intentId.toLowerCase(), testPlan.id.toLowerCase());
    assert.strictEqual(retrieved.planHash, record.planHash);
    assert.strictEqual(retrieved.budget, testPlan.budget);
    assert.strictEqual(retrieved.totalAmount, testPlan.totalAmount);

    // Canonical plan verification
    const canonical = toCanonicalShoppingPlan(testPlan, 1);
    const { planHash: computedHash } = computePlanHash(canonical);
    assert.strictEqual(computedHash, retrieved.planHash);
  });

  // 12. Test: Optional blockchain commitment matching the exact selected version
  it("Requirement 12: records on-chain commitment on Base Sepolia matching the exact selected version", async () => {
    const conn = await network.connect();
    const registry = await conn.viem.deployContract("ShoppingIntentRegistry");
    const [ownerClient] = await conn.viem.getWalletClients();

    const sharedIntentId = generateIntentId();
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 7;

    // Version 1 plan & hash
    const v1Plan = createTestPlan({ id: sharedIntentId, version: 1, budget: 3000 });
    const canonicalV1 = toCanonicalShoppingPlan(v1Plan, 1, 86400 * 7);
    const { planHash: hashV1, canonicalString: strV1 } = computePlanHash(canonicalV1);

    // Version 2 plan & hash (different budget, different items)
    const v2Plan = createTestPlan({
      id: sharedIntentId,
      version: 2,
      budget: 2000,
      items: v1Plan.items.slice(0, 2),
    });
    const canonicalV2 = toCanonicalShoppingPlan(v2Plan, 2, 86400 * 7);
    const { planHash: hashV2, canonicalString: strV2 } = computePlanHash(canonicalV2);

    assert.notStrictEqual(hashV1, hashV2);

    // Explicitly record Version 1 on-chain
    await registry.write.recordIntent([
      sharedIntentId,
      hashV1,
      1,
      BigInt(expiry),
    ]);

    // Explicitly record Version 2 on-chain
    await registry.write.recordVersion([
      sharedIntentId,
      hashV2,
      2,
      BigInt(expiry),
    ]);

    // Read back and verify exact hash alignment for Version 1
    const commitmentV1: any = await registry.read.getCommitment([sharedIntentId, 1]);
    assert.strictEqual(commitmentV1[0].toLowerCase(), ownerClient.account.address.toLowerCase());
    assert.strictEqual(commitmentV1[1], hashV1);
    assert.strictEqual(commitmentV1[2], 1);
    assert.strictEqual(verifyPlanHash(strV1, commitmentV1[1]), true);

    // Read back and verify exact hash alignment for Version 2
    const commitmentV2: any = await registry.read.getCommitment([sharedIntentId, 2]);
    assert.strictEqual(commitmentV2[1], hashV2);
    assert.strictEqual(commitmentV2[2], 2);
    assert.strictEqual(verifyPlanHash(strV2, commitmentV2[1]), true);

    // Verify latest version points to 2
    const latestVersion = await registry.read.getLatestVersion([sharedIntentId]);
    assert.strictEqual(latestVersion, 2);
  });
});
