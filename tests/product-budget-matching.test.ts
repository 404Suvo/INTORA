import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  parseBudgetIntentDeterministically,
  validateBudgetIntent,
  calculateInitialPriceTolerance,
  widenPriceTolerance,
  calculateTargetPriceDelta,
  computePriceProximityScore,
  rankCandidatesForSingleProductTarget,
  rankCandidatesForSingleProductMax,
  extractExplicitPriceBounds,
} from "../lib/budget-intent";
import { generateRealShoppingPlan } from "../lib/planner-engine";
import { ShoppingPlanData, ProductItem } from "../data/mockData";
import { NormalizedProduct, UserRequirement } from "../lib/trade-off-engine";
import { simulateShoppingPlan, interpretScenarioRequest } from "../lib/what-if";

describe("Product-Level Budget Matching Test Suite", () => {
  // ==========================================================================
  // 1. INTENT CLASSIFICATION & DISAMBIGUATION
  // ==========================================================================
  describe("Shopping Intent Classification", () => {
    it("Request A: 'Find a laptop with a budget of ₹1,00,000' classifies as single_product_target without accessories", () => {
      const prompt = "Find a laptop with a budget of ₹1,00,000.";
      const intent = parseBudgetIntentDeterministically(prompt, 100000);

      assert.strictEqual(intent.budgetMode, "single_product_target");
      assert.strictEqual(intent.targetProduct.toLowerCase(), "laptop");
      assert.strictEqual(intent.targetPrice, 100000);
      assert.strictEqual(intent.includeAccessories, false);
      assert.strictEqual(intent.priceTolerance.minPrice, 85000);
      assert.strictEqual(intent.priceTolerance.maxPrice, 110000);
      assert.strictEqual(intent.priceTolerance.isWidened, false);
    });

    it("Request B: 'Build me a complete laptop setup under ₹1,00,000, including a monitor and keyboard' classifies as total_basket_cap", () => {
      const prompt =
        "Build me a complete laptop setup under ₹1,00,000, including a monitor and keyboard.";
      const intent = parseBudgetIntentDeterministically(prompt, 100000);

      assert.strictEqual(intent.budgetMode, "total_basket_cap");
      assert.strictEqual(intent.includeAccessories, true);
      assert.strictEqual(intent.maximumPrice, 100000);
    });

    it("Request C: 'Find the cheapest laptop under ₹1,00,000' classifies as single_product_max", () => {
      const prompt = "Find the cheapest laptop under ₹1,00,000.";
      const intent = parseBudgetIntentDeterministically(prompt, 100000);

      assert.strictEqual(intent.budgetMode, "single_product_max");
      assert.strictEqual(intent.targetProduct.toLowerCase(), "laptop");
      assert.strictEqual(intent.maximumPrice, 100000);
      assert.strictEqual(intent.includeAccessories, false);
    });

    it("Request D: 'Find a laptop around ₹1,00,000' classifies as single_product_target", () => {
      const prompt = "Find a laptop around ₹1,00,000.";
      const intent = parseBudgetIntentDeterministically(prompt, 100000);

      assert.strictEqual(intent.budgetMode, "single_product_target");
      assert.strictEqual(intent.targetPrice, 100000);
      assert.strictEqual(intent.includeAccessories, false);
    });
  });

  // ==========================================================================
  // 2. EXPLICIT PRICE BOUNDS & TOLERANCE WIDENING
  // ==========================================================================
  describe("Price Bounds & Progressive Widening", () => {
    it("preserves explicit price bounds like 'between ₹80,000 and ₹1,20,000'", () => {
      const bounds = extractExplicitPriceBounds(
        "I need a laptop between ₹80,000 and ₹1,20,000 with 16GB RAM"
      );
      assert.strictEqual(bounds.explicitMin, 80000);
      assert.strictEqual(bounds.explicitMax, 120000);

      const tolerance = calculateInitialPriceTolerance(100000, bounds.explicitMin, bounds.explicitMax);
      assert.strictEqual(tolerance.minPrice, 80000);
      assert.strictEqual(tolerance.maxPrice, 120000);
    });

    it("progressively widens tolerance to 70%–125% when zero products match initial window", () => {
      const initial = calculateInitialPriceTolerance(100000);
      assert.strictEqual(initial.minPrice, 85000);
      assert.strictEqual(initial.maxPrice, 110000);
      assert.strictEqual(initial.isWidened, false);

      const widened = widenPriceTolerance(initial, 100000);
      assert.strictEqual(widened.minPrice, 70000);
      assert.strictEqual(widened.maxPrice, 125000);
      assert.strictEqual(widened.isWidened, true);
      assert.ok(widened.wideningReason?.includes("Expanded target price window"));
    });

    it("strictly preserves explicit maximum when widening and never exceeds platform limit ₹2,00,000", () => {
      const initial = calculateInitialPriceTolerance(190000, undefined, 195000);
      const widened = widenPriceTolerance(initial, 190000, undefined, 195000);

      // Widening cannot breach user's explicit max of 195,000
      assert.strictEqual(widened.maxPrice, 195000);
      assert.ok(widened.maxPrice <= 200000);
    });

    it("rejects negative, invalid, or over-limit budgets", () => {
      const invalidOver = validateBudgetIntent(
        {
          budgetMode: "single_product_target",
          targetProduct: "laptop",
          targetPrice: 250000,
          currency: "INR",
          includeAccessories: false,
          priceTolerance: { minRatio: 0.85, maxRatio: 1.1, minPrice: 85000, maxPrice: 110000, isWidened: false },
          mustHaveRequirements: [],
          rawPrompt: "test",
          explanation: "test",
        },
        250000
      );
      assert.strictEqual(invalidOver.valid, false);

      const invalidMin = validateBudgetIntent(
        {
          budgetMode: "single_product_target",
          targetProduct: "laptop",
          targetPrice: 100000,
          minimumPrice: -500,
          currency: "INR",
          includeAccessories: false,
          priceTolerance: { minRatio: 0.85, maxRatio: 1.1, minPrice: 85000, maxPrice: 110000, isWidened: false },
          mustHaveRequirements: [],
          rawPrompt: "test",
          explanation: "test",
        },
        100000
      );
      assert.strictEqual(invalidMin.valid, false);
    });
  });

  // ==========================================================================
  // 3. PRODUCT-LEVEL PRICE MATCHING & RANKING
  // ==========================================================================
  describe("Product-Level Price Matching & Ranking", () => {
    const createMockProduct = (
      id: string,
      name: string,
      unitPrice: number,
      rating: number | null = 4.2,
      specs: Record<string, string> = {}
    ): NormalizedProduct => ({
      productId: id,
      name,
      category: "electronics",
      merchant: "Amazon.in",
      currency: "INR",
      productUrl: `https://www.amazon.in/dp/${id}`,
      unitPrice,
      inStock: true,
      rating,
      reviewCount: rating ? 250 : null,
      specifications: specs,
      features: Object.values(specs),
      badges: ["Prime"],
      source: "fixture",
      lastCheckedAt: new Date().toISOString(),
    });

    it("prefers products in the target price range over much cheaper products", () => {
      const candidate40k = createMockProduct("lap-40k", "Budget Basic Laptop 8GB", 40000);
      const candidate95k = createMockProduct("lap-95k", "High Performance Laptop 16GB", 95000);
      const candidate140k = createMockProduct("lap-140k", "Ultra Gaming Laptop 32GB", 140000);

      const intent = parseBudgetIntentDeterministically("Find a laptop around ₹1,00,000", 100000);
      const ranked = rankCandidatesForSingleProductTarget(
        [candidate40k, candidate95k, candidate140k],
        intent,
        intent.priceTolerance
      );

      // 95k laptop is within the 85k-110k target range and must rank #1
      assert.strictEqual(ranked[0].product.productId, "lap-95k");
      assert.strictEqual(ranked[0].isInInitialRange, true);
      assert.strictEqual(ranked[0].priceDelta.absolute, -5000);
      assert.strictEqual(ranked[0].priceDelta.percentage, -5);
    });

    it("ensures must-have specifications strictly outrank mere price proximity", () => {
      // Laptop A is closer in price (99k vs 100k) but lacks 16GB RAM
      const laptopA = createMockProduct("lap-a", "Laptop 8GB RAM Standard", 99000, 4.0, {
        ram: "8GB RAM",
      });
      // Laptop B is slightly further in price (92k vs 100k) but satisfies the required 16GB RAM
      const laptopB = createMockProduct("lap-b", "Laptop 16GB RAM Pro", 92000, 4.3, {
        ram: "16GB RAM",
      });

      const intent = parseBudgetIntentDeterministically(
        "Find a laptop with 16GB RAM with a budget of ₹1,00,000",
        100000
      );
      const reqs: UserRequirement[] = [
        {
          id: "req_16gb",
          text: "16GB RAM",
          isMustHave: true,
          tokens: ["16gb", "16 gb"],
        },
      ];

      const ranked = rankCandidatesForSingleProductTarget(
        [laptopA, laptopB],
        intent,
        intent.priceTolerance,
        reqs
      );

      // Laptop B satisfies the must-have requirement and must beat Laptop A
      assert.strictEqual(ranked[0].product.productId, "lap-b");
      assert.strictEqual(ranked[0].satisfiesMustHaves, true);
      assert.strictEqual(ranked[1].product.productId, "lap-a");
      assert.strictEqual(ranked[1].satisfiesMustHaves, false);
    });

    it("ranks candidates for single_product_max by value and quality, not proximity to ceiling", () => {
      // 98k laptop: mediocre rating
      const laptopExpensive = createMockProduct("lap-98k", "Average Laptop", 98000, 3.5);
      // 75k laptop: highly rated, great quality
      const laptopValue = createMockProduct("lap-75k", "Top Rated Value Laptop", 75000, 4.6);

      const ranked = rankCandidatesForSingleProductMax(
        [laptopExpensive, laptopValue],
        100000,
        [],
        "balanced"
      );

      // Value laptop with higher quality should win, not the one closest to 100k
      assert.strictEqual(ranked[0].product.productId, "lap-75k");
      assert.ok(ranked[0].priceFitRationale.includes("within your ₹1,00,000 ceiling"));
    });
  });

  // ==========================================================================
  // 4. END-TO-END PLANNER ENGINE: NO UNRELATED ACCESSORY PACKING
  // ==========================================================================
  describe("Planner Engine Product-Level Plan Generation", () => {
    let originalKey: string | undefined;
    let originalFetch: typeof globalThis.fetch;

    before(() => {
      originalKey = process.env.SCRAPERAPI_KEY;
      originalFetch = globalThis.fetch;
      process.env.SCRAPERAPI_KEY = "dummy_test_key_xyz";

      (globalThis as any).fetch = async () => {
        return new Response(
          JSON.stringify({
            results: [
              {
                asin: "B0TESTLAP01",
                name: "Dell Inspiron 15 Core i5 16GB RAM 512GB SSD Laptop",
                price: 94990,
                price_string: "₹94,990.00",
                stars: 4.4,
                total_reviews: 820,
                url: "https://www.amazon.in/dp/B0TESTLAP01",
              },
              {
                asin: "B0TESTLAP02",
                name: "Budget Chromebook 4GB RAM Laptop",
                price: 24990,
                price_string: "₹24,990.00",
                stars: 3.9,
                total_reviews: 140,
                url: "https://www.amazon.in/dp/B0TESTLAP02",
              },
              {
                asin: "B0TESTLAP03",
                name: "Lenovo IdeaPad Slim 3 16GB RAM Laptop",
                price: 79990,
                price_string: "₹79,990.00",
                stars: 4.3,
                total_reviews: 410,
                url: "https://www.amazon.in/dp/B0TESTLAP03",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };
    });

    after(() => {
      if (originalKey !== undefined) {
        process.env.SCRAPERAPI_KEY = originalKey;
      } else {
        delete process.env.SCRAPERAPI_KEY;
      }
      globalThis.fetch = originalFetch;
    });

    it("generates single-product plan without packing accessories to consume remaining budget", async () => {
      // Using mock offline planner call via skipGemini and mock provider results
      const prompt = "Find a laptop with a budget of ₹1,00,000";
      // We pass skipGemini: true
      // planner-engine will interpret intent as single_product_target
      const plan = await generateRealShoppingPlan(prompt, 100000, {
        skipGemini: true,
      });

      assert.strictEqual(plan.budgetMode, "single_product_target");
      assert.ok(plan.items.length >= 1);
      // Crucial: Single product target must NOT add unrelated items to fill the 100k basket
      // The items array must contain only 1 primary recommended item
      assert.strictEqual(plan.items.length, 1);
      assert.strictEqual(plan.items[0].quantity, 1);
      assert.ok(plan.items[0].targetPriceDelta !== undefined);
      assert.ok(plan.items[0].priceFitRationale !== undefined);
    });

    it("preserves budgetMode and recalculates target in what-if simulation", async () => {
      const prompt = "Find a laptop with a budget of ₹1,00,000";
      const plan = await generateRealShoppingPlan(prompt, 100000, {
        skipGemini: true,
      });

      assert.strictEqual(plan.budgetMode, "single_product_target");

      // What-if scenario: budget drops to ₹80,000
      const scenario = await interpretScenarioRequest(
        "What if my budget drops to ₹80,000?",
        {
          currentBudget: plan.budget,
          currentSituation: plan.situation,
          currentItems: plan.items,
          parentPlanId: plan.id,
          parentVersion: 1,
        },
        { skipGemini: true }
      );

      const simResult = await simulateShoppingPlan(plan, scenario);
      assert.strictEqual(simResult.newPlan.budget, 80000);
      assert.strictEqual(simResult.newPlan.budgetMode, "single_product_target");
      assert.strictEqual(simResult.newPlan.targetPriceRange?.minPrice, 68000); // 85% of 80,000
      assert.strictEqual(simResult.newPlan.targetPriceRange?.maxPrice, 88000); // 110% of 80,000
    });
  });
});
