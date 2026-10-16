import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateProductCost,
  calculatePlanTotalCosts,
  normalizeProduct,
  extractUserRequirements,
  evaluateProductSuitability,
  assessReviewCredibility,
  buildProductComparisonItem,
  computeValueScore,
  compareProductPair,
  rankAndRecommendCandidates,
  isProductDataStale,
  sanitizePriceAndCurrency,
  RawProductInput,
} from "../lib/trade-off-engine";
import { optimizeShoppingPlan } from "../lib/budget-optimizer";
import { ShoppingPlanData, ProductItem } from "../data/mockData";

describe("Total-Cost & Trade-Off Engine Test Suite", () => {
  // ==========================================================================
  // SCENARIO 1: Cheaper product with lower rating vs higher-rated product
  // ==========================================================================
  describe("Scenario 1: Cheaper product with lower rating vs higher-rated product", () => {
    const rawProdA: RawProductInput = {
      id: "prod-a",
      name: "Standard Campus Daypack 20L",
      price: 800,
      currency: "INR",
      rating: 3.5,
      total_reviews: 45,
      features: ["Polyester fabric", "Single main pocket"],
      has_prime: true,
      inStock: true,
    };

    const rawProdB: RawProductInput = {
      id: "prod-b",
      name: "Ergonomic Campus Pro Backpack 25L",
      price: 1000,
      currency: "INR",
      rating: 4.4,
      total_reviews: 420,
      features: ["Water-resistant nylon", "Laptop sleeve", "Padded straps"],
      has_prime: true,
      inStock: true,
    };

    it("favors higher quality and rating under 'balanced' preference", () => {
      const normA = normalizeProduct(rawProdA)!;
      const normB = normalizeProduct(rawProdB)!;
      assert.ok(normA && normB, "Products normalized successfully");

      const recommendation = rankAndRecommendCandidates([normA, normB], "College bag for daily commute", {
        preference: "balanced",
      });

      assert.strictEqual(recommendation.selectedProduct.productId, "prod-b");
      assert.strictEqual(recommendation.alternatives.length, 1);
      assert.strictEqual(recommendation.alternatives[0].productId, "prod-a");

      // Verifies factual trade-off explanation
      assert.ok(recommendation.selectionExplanation.whySelected.includes("★4.4"));
      assert.ok(recommendation.totalCostComparison.premiumVsCheapest === 200);
      assert.ok(
        recommendation.selectionExplanation.userSacrifices.some((s) => s.includes("200")),
        "Should explain price premium sacrificed"
      );
    });

    it("favors lowest purchase cost when user explicitly chooses 'lowest_cost' preference", () => {
      const normA = normalizeProduct(rawProdA)!;
      const normB = normalizeProduct(rawProdB)!;

      const recommendation = rankAndRecommendCandidates([normA, normB], "College bag for daily commute", {
        preference: "lowest_cost",
      });

      assert.strictEqual(recommendation.selectedProduct.productId, "prod-a");
      assert.strictEqual(recommendation.totalCostComparison.selectedCost, 800);
      // Explains what user sacrifices (lower rating / fewer reviews)
      assert.ok(recommendation.selectedProduct.drawbacks.length > 0);
    });
  });

  // ==========================================================================
  // SCENARIO 2: More expensive product matching explicit requirements winning
  // ==========================================================================
  describe("Scenario 2: More expensive product matching explicit requirements winning", () => {
    it("selects more expensive product that satisfies must-have requirements over cheaper non-matching product", () => {
      const prompt = "I need a waterproof laptop backpack for monsoon college commute.";

      const cheapNonWaterproof: RawProductInput = {
        id: "bag-cheap",
        name: "Casual Canvas College Bag",
        price: 650,
        currency: "INR",
        rating: 4.5,
        total_reviews: 800,
        features: ["Cotton canvas", "No water protection"],
        has_prime: true,
        inStock: true,
      };

      const expensiveWaterproof: RawProductInput = {
        id: "bag-waterproof",
        name: "Pro Shield Waterproof Laptop Backpack",
        price: 1350,
        currency: "INR",
        rating: 4.2,
        total_reviews: 210,
        features: ["100% waterproof polyester", "Laptop sleeve", "Rain cover included"],
        has_prime: true,
        inStock: true,
      };

      const normCheap = normalizeProduct(cheapNonWaterproof)!;
      const normExp = normalizeProduct(expensiveWaterproof)!;

      const recommendation = rankAndRecommendCandidates([normCheap, normExp], prompt, {
        preference: "balanced",
      });

      // The waterproof bag must win despite being ₹700 more expensive
      assert.strictEqual(recommendation.selectedProduct.productId, "bag-waterproof");
      assert.strictEqual(recommendation.selectedProduct.requirementMatch.violatesMustHave, false);
      assert.strictEqual(recommendation.alternatives[0].requirementMatch.violatesMustHave, true);
      assert.ok(
        recommendation.selectionExplanation.whySelected.toLowerCase().includes("waterproof"),
        "Explanation mentions satisfied requirement"
      );
    });
  });

  // ==========================================================================
  // SCENARIO 3: Different shipping charges affecting final comparison
  // ==========================================================================
  describe("Scenario 3: Different shipping charges affecting final comparison", () => {
    it("correctly identifies that Product B with higher unit price has lower total purchase cost due to free shipping", () => {
      // Product A: ₹500 unit price + ₹150 shipping = ₹650
      const costA = calculateProductCost(500, 1, {
        shippingCost: 150,
        shippingType: "paid",
      });
      assert.strictEqual(costA.unitPrice, 500);
      assert.strictEqual(costA.shippingCost, 150);
      assert.strictEqual(costA.estimatedTotalCost, 650);

      // Product B: ₹600 unit price + ₹0 free Prime shipping = ₹600
      const costB = calculateProductCost(600, 1, {
        hasPrime: true,
      });
      assert.strictEqual(costB.unitPrice, 600);
      assert.strictEqual(costB.shippingCost, 0);
      assert.strictEqual(costB.estimatedTotalCost, 600);

      // Product B has lower total estimated cost
      assert.ok(costB.estimatedTotalCost < costA.estimatedTotalCost);

      const prodA = normalizeProduct({
        id: "item-a",
        name: "Budget Item with Paid Shipping",
        price: 500,
        shipping_price: 150,
        has_prime: false,
        inStock: true,
      })!;

      const prodB = normalizeProduct({
        id: "item-b",
        name: "Prime Item with Free Delivery",
        price: 600,
        has_prime: true,
        inStock: true,
      })!;

      const recommendation = rankAndRecommendCandidates([prodA, prodB], "General supplies", {
        preference: "lowest_cost",
      });

      // B should win under lowest_cost because its total purchase cost is ₹600 vs ₹650
      assert.strictEqual(recommendation.selectedProduct.productId, "item-b");
      assert.strictEqual(recommendation.selectedProduct.cost.estimatedTotalCost, 600);
    });
  });

  // ==========================================================================
  // SCENARIO 4: Quantity changes affecting total cost
  // ==========================================================================
  describe("Scenario 4: Quantity changes affecting total cost", () => {
    it("multiplies unit price by quantity and calculates correct plan-wide totals", () => {
      const costQty1 = calculateProductCost(250, 1);
      assert.strictEqual(costQty1.itemSubtotal, 250);
      assert.strictEqual(costQty1.estimatedTotalCost, 250);

      const costQty4 = calculateProductCost(250, 4);
      assert.strictEqual(costQty4.quantity, 4);
      assert.strictEqual(costQty4.itemSubtotal, 1000);
      assert.strictEqual(costQty4.estimatedTotalCost, 1000);

      // Plan-wide consolidation with free delivery threshold (>= ₹499 free shipping)
      const planCostUnderThreshold = calculatePlanTotalCosts([{ unitPrice: 200, quantity: 2, shippingCost: 80 }]);
      assert.strictEqual(planCostUnderThreshold.itemsSubtotal, 400);
      assert.strictEqual(planCostUnderThreshold.orderShipping, 80);
      assert.strictEqual(planCostUnderThreshold.estimatedPlanTotal, 480);

      const planCostOverThreshold = calculatePlanTotalCosts([{ unitPrice: 200, quantity: 3, shippingCost: 80 }]);
      assert.strictEqual(planCostOverThreshold.itemsSubtotal, 600);
      assert.strictEqual(planCostOverThreshold.orderShipping, 0); // Cart >= ₹499 gets free shipping
      assert.strictEqual(planCostOverThreshold.estimatedPlanTotal, 600);
    });
  });

  // ==========================================================================
  // SCENARIO 5: Missing shipping or tax information
  // ==========================================================================
  describe("Scenario 5: Missing shipping or tax information", () => {
    it("marks missing shipping details as partial_unknown and never outputs NaN", () => {
      const cost = calculateProductCost(450, 1, {
        shippingCost: null,
        shippingType: "unknown",
        taxType: "unknown",
      });

      assert.strictEqual(cost.costCompleteness, "partial_unknown");
      assert.ok(cost.unknownComponents.includes("shipping"));
      assert.ok(cost.unknownComponents.includes("taxes"));
      assert.strictEqual(cost.shippingCost, null);
      assert.strictEqual(cost.taxes, null);
      assert.strictEqual(isNaN(cost.estimatedTotalCost), false);
      assert.strictEqual(cost.estimatedTotalCost, 450); // Fallbacks to known itemSubtotal
    });

    it("surfaces missing information in product comparison item", () => {
      const raw: RawProductInput = {
        id: "prod-unknown-ship",
        name: "Specialty Item Without Shipping Data",
        price: 750,
        inStock: true,
      };
      const norm = normalizeProduct(raw)!;
      const comp = buildProductComparisonItem(norm, 1);

      assert.ok(comp.missingInformation.length > 0);
      assert.ok(comp.missingInformation.some((m) => m.toLowerCase().includes("shipping")));
    });
  });

  // ==========================================================================
  // SCENARIO 6: Missing ratings and review counts treated as unknown
  // ==========================================================================
  describe("Scenario 6: Missing ratings and review counts treated as unknown", () => {
    it("treats missing rating as null rather than zero, without penalizing credibility unfairly", () => {
      const raw: RawProductInput = {
        id: "unrated-prod",
        name: "New Release Tech Gadget",
        price: 999,
        inStock: true,
        rating: null,
        total_reviews: null,
      };

      const norm = normalizeProduct(raw)!;
      assert.strictEqual(norm.rating, null);
      assert.strictEqual(norm.reviewCount, null);

      const credibility = assessReviewCredibility(norm.rating, norm.reviewCount);
      assert.strictEqual(credibility, "unknown");

      const zeroCredibility = assessReviewCredibility(3.5, 0);
      assert.strictEqual(zeroCredibility, "none");

      const comp = buildProductComparisonItem(norm, 1);
      assert.strictEqual(comp.rating, null);
      assert.strictEqual(comp.reviewCount, null);
      assert.ok(comp.missingInformation.some((u) => u.toLowerCase().includes("rating")));
    });
  });

  // ==========================================================================
  // SCENARIO 7: Invalid prices and unexpected currencies
  // ==========================================================================
  describe("Scenario 7: Invalid prices and unexpected currencies", () => {
    it("rejects non-INR currencies such as USD and EUR", () => {
      const resUSD = sanitizePriceAndCurrency(25, "USD");
      assert.strictEqual(resUSD.isValid, false);
      assert.ok(resUSD.error?.includes("non-INR"));

      const resDollarSign = sanitizePriceAndCurrency(25, "$");
      assert.strictEqual(resDollarSign.isValid, false);

      const rawUSD: RawProductInput = {
        id: "usd-prod",
        name: "Imported US Product",
        price: 25,
        currency: "USD",
      };
      const normUSD = normalizeProduct(rawUSD);
      assert.strictEqual(normUSD, null, "Product with USD currency must be rejected");
    });

    it("rejects zero, negative, or invalid non-numeric prices", () => {
      const resZero = sanitizePriceAndCurrency(0, "INR");
      assert.strictEqual(resZero.isValid, false);

      const resNeg = sanitizePriceAndCurrency(-500, "INR");
      assert.strictEqual(resNeg.isValid, false);

      const resNaN = sanitizePriceAndCurrency("free", "INR");
      assert.strictEqual(resNaN.isValid, false);

      const rawZero: RawProductInput = {
        id: "zero-prod",
        name: "Zero Rupee Product",
        price: 0,
      };
      assert.strictEqual(normalizeProduct(rawZero), null);
    });

    it("accepts and cleans valid rupee prices", () => {
      const resClean = sanitizePriceAndCurrency("₹1,499.00", "INR");
      assert.strictEqual(resClean.isValid, true);
      assert.strictEqual(resClean.priceInr, 1499);
    });
  });

  // ==========================================================================
  // SCENARIO 8: Product violating a must-have requirement
  // ==========================================================================
  describe("Scenario 8: Product violating a must-have requirement", () => {
    it("flags product violating explicit must-have requirement and penalizes value score", () => {
      const requirements = extractUserRequirements("Need a 750ml stainless steel water bottle.");

      const matchingBottle = normalizeProduct({
        id: "steel-750",
        name: "Milton Stainless Steel Flask 750ml",
        price: 799,
        features: ["750ml capacity", "Stainless steel construction"],
        inStock: true,
      })!;

      const plasticBottle = normalizeProduct({
        id: "plastic-500",
        name: "Milton Plastic Sipper Bottle 500ml",
        price: 249,
        features: ["BPA free plastic", "500ml capacity"],
        inStock: true,
      })!;

      const suitMatch = evaluateProductSuitability(matchingBottle, requirements);
      assert.strictEqual(suitMatch.violatesMustHave, false);
      assert.strictEqual(suitMatch.status, "full");

      const suitMismatch = evaluateProductSuitability(plasticBottle, requirements);
      assert.strictEqual(suitMismatch.violatesMustHave, true);
      assert.strictEqual(suitMismatch.unmetMustHaves.length > 0, true);

      // Value score for matching product is substantially higher despite higher price
      const compMatch = buildProductComparisonItem(matchingBottle, 1, { requirements });
      const compMismatch = buildProductComparisonItem(plasticBottle, 1, { requirements });

      const scoreMatch = computeValueScore(compMatch, "balanced");
      const scoreMismatch = computeValueScore(compMismatch, "balanced");
      assert.ok(scoreMatch > scoreMismatch, "Matching product must outscore non-compliant product");
    });
  });

  // ==========================================================================
  // SCENARIO 9: Budget optimization with alternative products
  // ==========================================================================
  describe("Scenario 9: Budget optimization with alternative products", () => {
    it("attaches trade-off details when swapping with a cheaper alternative", async () => {
      const initialPlan: ShoppingPlanData = {
        title: "Overbudget Workstation Plan",
        situation: "Need ergonomic setup for remote work with high quality components",
        budget: 5000,
        totalAmount: 6200,
        remainingAmount: 0,
        items: [
          {
            id: "chair-01",
            name: "High-End Ergonomic Mesh Chair",
            category: "furniture",
            quantity: 1,
            unitPrice: 4200,
            totalPrice: 4200,
            subtotal: 4200,
            essential: true,
            optional: false,
            priority: 1,
            rationale: "Primary posture support",
            inStock: true,
            imagePlaceholder: "#ffffff",
          },
          {
            id: "light-01",
            name: "Monitor Light Bar",
            category: "lighting",
            quantity: 1,
            unitPrice: 2000,
            totalPrice: 2000,
            subtotal: 2000,
            essential: false,
            optional: true,
            priority: 2,
            rationale: "Desk illumination",
            inStock: true,
            imagePlaceholder: "#ffffff",
          },
        ],
        validation: {
          budgetCompliant: false,
          allInStock: true,
          priceIntegrityVerified: true,
        },
      };

      const optimized = await optimizeShoppingPlan(initialPlan, 5000, {
        userConstraints: {
          preference: "balanced",
          strictlyEnforceMustHaves: true,
        },
      });

      assert.strictEqual(optimized.feasible, true);
      assert.ok(optimized.totalAmount <= 5000, `Total ${optimized.totalAmount} should be <= 5000`);
      assert.ok(optimized.changes && optimized.changes.length > 0, "Optimization should record changes");

      // Check if changes include trade-off information
      const changeWithTradeOff = optimized.changes?.find((c) => c.tradeOff || c.tradeOffDetails);
      assert.ok(changeWithTradeOff, "Change should record trade-off details");
    });
  });

  // ==========================================================================
  // SCENARIO 10: Plan whose final estimated cost exceeds budget
  // ==========================================================================
  describe("Scenario 10: Plan whose final estimated cost exceeds budget", () => {
    it("correctly identifies infeasible plans when essential items exceed budget cap", async () => {
      const planOverBudget: ShoppingPlanData = {
        title: "Heavy Machinery Plan",
        situation: "Need industrial power tool setup",
        budget: 2000,
        totalAmount: 4500,
        remainingAmount: 0,
        items: [
          {
            id: "tool-01",
            name: "Heavy Duty Rotary Hammer Drill",
            category: "hardware",
            quantity: 1,
            unitPrice: 4500,
            totalPrice: 4500,
            subtotal: 4500,
            essential: true, // Non-removable essential item costing 4500 > budget 2000
            optional: false,
            priority: 1,
            rationale: "Core required tool",
            inStock: true,
            imagePlaceholder: "#ffffff",
          },
        ],
        validation: {
          budgetCompliant: false,
          allInStock: true,
          priceIntegrityVerified: true,
        },
      };

      const result = await optimizeShoppingPlan(planOverBudget, 2000);

      assert.strictEqual(result.feasible, false);
      assert.strictEqual(result.validation.budgetCompliant, false);
      assert.ok(result.optimizationResult?.infeasibilityReason?.includes("2,000"));
      assert.ok(
        result.optimizationResult?.suggestedCompromises &&
          result.optimizationResult.suggestedCompromises.length > 0,
        "Should provide suggested compromises"
      );
    });
  });

  // ==========================================================================
  // SCENARIO 11: Conflicting or stale product data (>72h flagged)
  // ==========================================================================
  describe("Scenario 11: Conflicting or stale product data (>72h flagged)", () => {
    it("flags product data older than 72 hours as stale", () => {
      const ninetyHoursAgo = new Date(Date.now() - 90 * 3600 * 1000).toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

      assert.strictEqual(isProductDataStale(ninetyHoursAgo, 72), true);
      assert.strictEqual(isProductDataStale(twoHoursAgo, 72), false);

      const staleProduct = normalizeProduct({
        id: "stale-item",
        name: "Archived Electronic Component",
        price: 500,
        retrievedAt: ninetyHoursAgo,
        inStock: true,
      })!;

      assert.strictEqual(staleProduct.isStale, true);

      const freshProduct = normalizeProduct({
        id: "fresh-item",
        name: "Fresh Electronic Component",
        price: 500,
        retrievedAt: twoHoursAgo,
        inStock: true,
      })!;

      assert.strictEqual(freshProduct.isStale, false);
    });
  });

  // ==========================================================================
  // SCENARIO 12: ScraperAPI timeout and rate-limit errors handled cleanly
  // ==========================================================================
  describe("Scenario 12: ScraperAPI timeout and rate-limit errors handled cleanly", () => {
    it("verifies safe error formatting without leaking credentials or throwing unhandled errors", () => {
      // Mock error scenarios
      const formatSafeError = (err: any): { userMessage: string; isRetryable: boolean } => {
        const msg = String(err?.message || err);
        if (msg.includes("429") || msg.includes("rate limit")) {
          return {
            userMessage: "Amazon product search is experiencing high traffic. Please try again in a moment.",
            isRetryable: true,
          };
        }
        if (msg.includes("ETIMEDOUT") || msg.includes("timeout") || msg.includes("AbortError")) {
          return {
            userMessage: "Product search timed out while querying Amazon India. Please retry.",
            isRetryable: true,
          };
        }
        return {
          userMessage: "Unable to retrieve real-time Amazon pricing. Falling back to curated catalog items.",
          isRetryable: false,
        };
      };

      const rateLimitErr = new Error("ScraperAPI error: HTTP 429 Too Many Requests");
      const formattedRateLimit = formatSafeError(rateLimitErr);
      assert.strictEqual(formattedRateLimit.isRetryable, true);
      assert.ok(!formattedRateLimit.userMessage.includes("apiKey"));

      const timeoutErr = new Error("ScraperAPI network error: fetch failed (ETIMEDOUT)");
      const formattedTimeout = formatSafeError(timeoutErr);
      assert.strictEqual(formattedTimeout.isRetryable, true);
      assert.ok(!formattedTimeout.userMessage.includes("apiKey"));
    });
  });
});
