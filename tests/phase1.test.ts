import assert from "node:assert";
import { describe, it } from "node:test";
import { PRODUCT_CATALOG, getProductById } from "../lib/catalog";
import { canonicalizePlan, normalizeAndSortItems } from "../lib/canonicalize";
import { computePlanDiff } from "../lib/diff";
import { generateIntentId } from "../lib/intent-id";
import { computePlanHash, hashCanonicalString, verifyPlanHash } from "../lib/plan-hash";
import { validatePlan } from "../lib/plan-validator";
import { ShoppingPlan } from "../lib/types";

describe("Phase 1: Shopping Plan Model, Validation, Canonicalization, and Hashing", () => {
  const dummyIntentId = generateIntentId();
  const futureExpiry = Math.floor(Date.now() / 1000) + 3600 * 24; // +24 hours

  it("validates a healthy plan within budget and matches catalog", () => {
    const rawPlan: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 300000, // ₹3,000.00
      items: [
        { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 },
        { productId: "gel-pen-set", quantity: 1, unitPriceMinor: 12000 },
      ],
      totalMinor: 62000, // 2*25000 + 12000 = 62000
      expiry: futureExpiry,
    };

    const res = validatePlan(rawPlan);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.priceMismatches.length, 0);
    assert.strictEqual(res.validatedPlan?.totalMinor, 62000);
  });

  it("rejects non-existent product IDs", () => {
    const plan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 100000,
      items: [{ productId: "non-existent-product-xyz", quantity: 1, unitPriceMinor: 5000 }],
      totalMinor: 5000,
      expiry: futureExpiry,
    };

    const res = validatePlan(plan);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("does not exist in the official catalog")));
  });

  it("rejects invalid quantities: zero, negative, floats, or > 100", () => {
    const badQuantities = [0, -1, 1.5, 101];
    for (const qty of badQuantities) {
      const plan = {
        schemaVersion: "1.0.0",
        intentId: dummyIntentId,
        version: 1,
        currency: "INR",
        budgetMinor: 100000,
        items: [{ productId: "college-notebook-pack", quantity: qty, unitPriceMinor: 25000 }],
        totalMinor: 25000,
        expiry: futureExpiry,
      };
      const res = validatePlan(plan);
      assert.strictEqual(res.valid, false, `Expected quantity ${qty} to fail validation`);
    }
  });

  it("rejects missing required fields", () => {
    const incompletePlan = {
      schemaVersion: "1.0.0",
      // missing intentId
      version: 1,
      currency: "INR",
      budgetMinor: 100000,
      items: [],
      totalMinor: 0,
      expiry: futureExpiry,
    };

    const res = validatePlan(incompletePlan);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("intentId")));
    assert.ok(res.errors.some((e) => e.includes("at least one item")));
  });

  it("detects AI price hallucination, flags mismatch, and overwrites with catalog price", () => {
    const realPrice = getProductById("college-notebook-pack")!.priceMinor; // 25000
    const hallucinatedPrice = 999; // AI hallucinated 999 paise

    const plan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 100000,
      items: [{ productId: "college-notebook-pack", quantity: 2, unitPriceMinor: hallucinatedPrice }],
      totalMinor: 2 * hallucinatedPrice,
      expiry: futureExpiry,
    };

    const res = validatePlan(plan);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.priceMismatches.length, 1);
    assert.strictEqual(res.priceMismatches[0].productId, "college-notebook-pack");
    assert.strictEqual(res.priceMismatches[0].aiPriceMinor, hallucinatedPrice);
    assert.strictEqual(res.priceMismatches[0].catalogPriceMinor, realPrice);

    // Assert that the returned validated plan overwrote the price and recomputed total
    assert.strictEqual(res.validatedPlan?.items[0].unitPriceMinor, realPrice);
    assert.strictEqual(res.validatedPlan?.totalMinor, 2 * realPrice);
  });

  it("rejects when plan total exceeds budget", () => {
    const plan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 40000, // ₹400 cap
      items: [
        { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 }, // 50,000 paise
      ],
      totalMinor: 50000,
      expiry: futureExpiry,
    };

    const res = validatePlan(plan);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("exceeds budget cap")));
  });

  it("rejects out-of-stock items", () => {
    const plan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 500000,
      items: [{ productId: "discontinued-usb-fan", quantity: 1, unitPriceMinor: 19900 }],
      totalMinor: 19900,
      expiry: futureExpiry,
    };

    const res = validatePlan(plan);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("out of stock")));
  });

  it("rejects past expiry timestamp", () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 100;
    const plan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 100000,
      items: [{ productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 }],
      totalMinor: 25000,
      expiry: pastTimestamp,
    };

    const res = validatePlan(plan);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("must be in the future")));
  });

  it("merges duplicate productIds and sums quantities", () => {
    const rawItems = [
      { productId: "gel-pen-set", quantity: 2, unitPriceMinor: 12000 },
      { productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 },
      { productId: "gel-pen-set", quantity: 3, unitPriceMinor: 12000 },
    ];

    const normalized = normalizeAndSortItems(rawItems);
    assert.strictEqual(normalized.length, 2);
    assert.strictEqual(normalized[0].productId, "college-notebook-pack");
    assert.strictEqual(normalized[0].quantity, 1);
    assert.strictEqual(normalized[1].productId, "gel-pen-set");
    assert.strictEqual(normalized[1].quantity, 5); // 2 + 3
  });

  it("produces deterministic canonical serialization regardless of item input order", () => {
    const planA: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 300000,
      items: [
        { productId: "highlighter-pack", quantity: 1, unitPriceMinor: 16000 },
        { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 },
      ],
      totalMinor: 66000,
      expiry: futureExpiry,
    };

    const planB: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 300000,
      items: [
        { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 },
        { productId: "highlighter-pack", quantity: 1, unitPriceMinor: 16000 },
      ],
      totalMinor: 66000,
      expiry: futureExpiry,
    };

    const strA = canonicalizePlan(planA);
    const strB = canonicalizePlan(planB);
    assert.strictEqual(strA, strB);
    assert.ok(!strA.includes(" ")); // no extraneous spaces

    const hashA = computePlanHash(planA);
    const hashB = computePlanHash(planB);
    assert.strictEqual(hashA.planHash, hashB.planHash);
    assert.strictEqual(hashA.canonicalString, strA);
    assert.strictEqual(verifyPlanHash(hashA.canonicalString, hashA.planHash), true);
  });

  it("computes accurate diff between two versions", () => {
    const planV1: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 1,
      currency: "INR",
      budgetMinor: 300000,
      items: [
        { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 },
        { productId: "gel-pen-set", quantity: 2, unitPriceMinor: 12000 },
      ],
      totalMinor: 74000,
      expiry: futureExpiry,
    };

    const planV2: ShoppingPlan = {
      schemaVersion: "1.0.0",
      intentId: dummyIntentId,
      version: 2,
      currency: "INR",
      budgetMinor: 200000, // Budget dropped to ₹2,000
      items: [
        { productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 }, // qty reduced
        { productId: "highlighter-pack", quantity: 1, unitPriceMinor: 16000 }, // added
      ],
      totalMinor: 41000,
      expiry: futureExpiry,
    };

    const diff = computePlanDiff(planV1, planV2);
    assert.strictEqual(diff.fromVersion, 1);
    assert.strictEqual(diff.toVersion, 2);
    assert.strictEqual(diff.budgetDeltaMinor, -100000);
    assert.strictEqual(diff.totalDeltaMinor, -33000);
    assert.strictEqual(diff.addedItems.length, 1);
    assert.strictEqual(diff.addedItems[0].productId, "highlighter-pack");
    assert.strictEqual(diff.removedItems.length, 1);
    assert.strictEqual(diff.removedItems[0].productId, "gel-pen-set");
    assert.strictEqual(diff.changedQuantities.length, 1);
    assert.strictEqual(diff.changedQuantities[0].productId, "college-notebook-pack");
    assert.strictEqual(diff.changedQuantities[0].oldQuantity, 2);
    assert.strictEqual(diff.changedQuantities[0].newQuantity, 1);
  });
});
