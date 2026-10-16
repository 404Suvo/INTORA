import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferItemPriorities,
  findCheaperAlternatives,
  optimizeShoppingPlan,
  processFollowUpRequest,
  validatePlanFinancials,
  normalizeProductItem,
} from "../lib/budget-optimizer";
import { ProductItem, ShoppingPlanData } from "../data/mockData";
import { ProductCatalogItem } from "../lib/types";

describe("Intelligent Budget Optimization Agent Test Suite", () => {
  // Test fixture generator
  const createMockPlan = (overrides: Partial<ShoppingPlanData> = {}): ShoppingPlanData => {
    const defaultItems: ProductItem[] = [
      {
        id: "backpack-01",
        name: "Pro Campus Backpack Waterproof",
        category: "supplies",
        quantity: 1,
        unitPrice: 1500,
        totalPrice: 1500,
        subtotal: 1500,
        essential: true,
        optional: false,
        priority: 1,
        rationale: "Main bag for carrying gear.",
        reason: "Main bag for carrying gear.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
      {
        id: "bottle-01",
        name: "Double Wall Stainless Flask (750ml)",
        category: "supplies",
        quantity: 1,
        unitPrice: 800,
        totalPrice: 800,
        subtotal: 800,
        essential: true,
        optional: false,
        priority: 1,
        rationale: "Required hydration flask.",
        reason: "Required hydration flask.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
      {
        id: "snack-bar-01",
        name: "Nut & Seed Energy Bar Pack",
        category: "snacks",
        quantity: 1,
        unitPrice: 400,
        totalPrice: 400,
        subtotal: 400,
        essential: false,
        optional: true,
        priority: 3,
        rationale: "Convenient snack pack.",
        reason: "Convenient snack pack.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
      {
        id: "highlighter-01",
        name: "Fluorescent Highlighter Pack",
        category: "stationery",
        quantity: 1,
        unitPrice: 300,
        totalPrice: 300,
        subtotal: 300,
        essential: false,
        optional: true,
        priority: 2,
        rationale: "Optional study stationery.",
        reason: "Optional study stationery.",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
    ];

    const total = defaultItems.reduce((acc, curr) => acc + (curr.subtotal || curr.totalPrice), 0);
    const budget = overrides.budget ?? 3500;

    return {
      id: "intent_test_01",
      title: "Campus Gear Bundle",
      situation: "Need college supplies with hydration and carrying bag.",
      budget,
      totalAmount: total,
      remainingAmount: Math.max(0, budget - total),
      version: 1,
      timestamp: "16 Oct 2026, 12:00 PM IST",
      planHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      items: defaultItems,
      validation: {
        budgetCompliant: total <= budget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      ...overrides,
    };
  };

  const mockCatalogPool: ProductCatalogItem[] = [
    {
      id: "alt-backpack-cheaper",
      name: "Standard Campus Daypack",
      category: "supplies",
      description: "Durable budget campus backpack.",
      priceMinor: 90000, // ₹900 (saves ₹600)
      inStock: true,
      availableStock: 25,
      unit: "piece",
      rating: 4.3,
      totalReviews: 850,
      source: "fixture",
    },
    {
      id: "alt-bottle-cheaper",
      name: "Classic Steel Water Bottle (750ml)",
      category: "supplies",
      description: "Simple stainless steel bottle.",
      priceMinor: 45000, // ₹450 (saves ₹350)
      inStock: true,
      availableStock: 40,
      unit: "piece",
      rating: 4.4,
      totalReviews: 1200,
      source: "fixture",
    },
  ];

  // 1. Scenario 1: Plan already fits within budget
  it("Scenario 1: returns plan without unnecessary changes when total already fits within budget", () => {
    const plan = createMockPlan({ budget: 3500 }); // total is ₹3000 <= ₹3500
    const optimized = optimizeShoppingPlan(plan, 3500, { candidateCatalog: mockCatalogPool });

    assert.strictEqual(optimized.feasible, true);
    assert.strictEqual(optimized.validation.budgetCompliant, true);
    assert.strictEqual(optimized.totalAmount, 3000);
    assert.strictEqual(optimized.remainingAmount, 500);
    assert.strictEqual(optimized.budgetOverrun, 0);
    assert.strictEqual(optimized.totalSavings, 0);
    assert.strictEqual(optimized.changes?.length, 0);
    assert.ok(optimized.optimizationSummary?.includes("already fits"));
  });

  // 2. Scenario 2: Plan exceeds budget, cheaper alternatives exist
  it("Scenario 2: replaces expensive items with cheaper alternatives and preserves essential requirements", () => {
    // Total is ₹3000, budget is ₹2400 (overrun: ₹600)
    // Backpack costs ₹1500, alternative costs ₹900 (saves ₹600)
    // Replacing backpack brings total to ₹2400, fitting budget without removing any items!
    const plan = createMockPlan({ budget: 2400 });
    const optimized = optimizeShoppingPlan(plan, 2400, { candidateCatalog: mockCatalogPool });

    assert.strictEqual(optimized.feasible, true);
    assert.strictEqual(optimized.validation.budgetCompliant, true);
    assert.strictEqual(optimized.totalAmount, 2400);
    assert.strictEqual(optimized.totalSavings, 600);
    assert.strictEqual(optimized.items.length, 4); // All 4 items preserved!

    // Verify replacement details
    const backpackItem = optimized.items.find((i) => i.id === "alt-backpack-cheaper");
    assert.ok(backpackItem, "Cheaper alternative backpack should be present in plan");
    assert.strictEqual(backpackItem.unitPrice, 900);

    // Verify explanation in changes
    const change = optimized.changes?.find((c) => c.type === "replaced");
    assert.ok(change, "Should log a replacement change");
    assert.strictEqual(change.savings, 600);
    assert.strictEqual(change.essentialAffected, false);
    assert.ok(change.reason.includes("Switching saves ₹600"));
  });

  // 3. Scenario 3: Cheaper alternatives do not exist or are insufficient; optional items are removed
  it("Scenario 3: removes optional items in priority order when alternatives are insufficient", () => {
    // Total is ₹3000, budget is ₹2300 (overrun: ₹700)
    // candidateCatalog is empty -> no alternatives exist
    // Must prune optional items in priority order:
    // 1. snack-bar (priority 3, ₹400) removed -> total becomes ₹2600
    // 2. highlighter (priority 2, ₹300) removed -> total becomes ₹2300 (fits budget exactly!)
    const plan = createMockPlan({ budget: 2300 });
    const optimized = optimizeShoppingPlan(plan, 2300, { candidateCatalog: [] });

    assert.strictEqual(optimized.feasible, true);
    assert.strictEqual(optimized.validation.budgetCompliant, true);
    assert.strictEqual(optimized.totalAmount, 2300);
    assert.strictEqual(optimized.totalSavings, 700);

    // Essential items are preserved
    assert.ok(optimized.items.some((i) => i.id === "backpack-01"));
    assert.ok(optimized.items.some((i) => i.id === "bottle-01"));
    // Both optional items were removed
    assert.ok(!optimized.items.some((i) => i.id === "snack-bar-01"));
    assert.ok(!optimized.items.some((i) => i.id === "highlighter-01"));

    // Removed changes logged with explanation
    const removeChanges = optimized.changes?.filter((c) => c.type === "removed");
    assert.strictEqual(removeChanges?.length, 2);
    assert.strictEqual(removeChanges[0].itemName, "Nut & Seed Energy Bar Pack");
    assert.strictEqual(removeChanges[1].itemName, "Fluorescent Highlighter Pack");
  });

  // 4. Scenario 4: Essential items alone exceed budget; declared infeasible
  it("Scenario 4: declares plan infeasible and details shortfall when essential items alone exceed budget", () => {
    // Both backpack (₹1500 or alt ₹900) and bottle (₹800 or alt ₹450) are essential
    // Lowest feasible cost with best alternatives = ₹900 + ₹450 = ₹1350
    // Budget is ₹1000 -> Impossible without violating essential requirements!
    const plan = createMockPlan({ budget: 1000 });
    const optimized = optimizeShoppingPlan(plan, 1000, { candidateCatalog: mockCatalogPool });

    assert.strictEqual(optimized.feasible, false, "Plan must be marked as infeasible");
    assert.strictEqual(optimized.validation.budgetCompliant, false, "budgetCompliant must be false when exceeding budget");
    assert.ok(optimized.totalAmount > 1000);
    assert.strictEqual(optimized.optimizationResult?.feasible, false);
    assert.ok(optimized.optimizationResult?.shortfallAmount! > 0);
    assert.strictEqual(optimized.optimizationResult?.lowestFeasibleTotal, optimized.totalAmount);
    assert.ok(optimized.optimizationResult?.infeasibilityReason?.includes("Essential items alone"));
    assert.ok(optimized.optimizationResult?.suggestedCompromises?.length! >= 2);
  });

  // 5. Scenario 5: User manually marks an optional item as essential; agent respects this choice
  it("Scenario 5: never removes an item user explicitly marked as essential", () => {
    // Mark the snack bar as essential: true
    const plan = createMockPlan({ budget: 2000 });
    const snackItem = plan.items.find((i) => i.id === "snack-bar-01")!;
    snackItem.essential = true;
    snackItem.optional = false;

    // Budget ₹2000: backpack alternative saves ₹600 (total ₹2400).
    // Now snack bar is essential, so it CANNOT be removed!
    // Instead, highlighter (optional, ₹300) and bottle alternative (saves ₹350) will be adjusted.
    const optimized = optimizeShoppingPlan(plan, 2000, {
      candidateCatalog: mockCatalogPool,
      userConstraints: { protectedItemIds: ["snack-bar-01"] },
    });

    // Snack bar must still be in the plan
    const snackInPlan = optimized.items.find((i) => i.id === "snack-bar-01");
    assert.ok(snackInPlan, "Manually marked essential item must not be removed");
    assert.strictEqual(snackInPlan.essential, true);
  });

  // 6. Scenario 6: Product API returns no alternatives for a category; agent reports limitation
  it("Scenario 6: reports limitation honestly without fabricating fictional products when no alternatives exist", () => {
    const item: ProductItem = {
      id: "rare-compass-01",
      name: "Vintage Brass Compass",
      category: "outdoor",
      quantity: 1,
      unitPrice: 2000,
      totalPrice: 2000,
      subtotal: 2000,
      essential: true,
      optional: false,
      priority: 1,
      rationale: "Compass navigation",
      reason: "Compass navigation",
      inStock: true,
      imagePlaceholder: "#ffffff",
    };

    // Catalog has no outdoor items or compasses
    const emptyCatalog: ProductCatalogItem[] = [];
    const alternatives = findCheaperAlternatives(item, emptyCatalog);

    assert.strictEqual(alternatives.length, 0, "Must return empty array instead of fabricating products");
  });

  // 7. Scenario 7: Item has missing or invalid price; agent handles gracefully
  it("Scenario 7: handles missing, NaN, or negative prices gracefully without breaking financial math", () => {
    const invalidRaw = {
      id: "broken-item",
      name: "Product With Corrupt Price",
      unitPrice: NaN as any,
      quantity: -2,
    };

    const normalized = normalizeProductItem(invalidRaw);
    assert.strictEqual(normalized.quantity, 1, "Quantity must normalize to >= 1");
    assert.strictEqual(normalized.unitPrice, 0, "Invalid price must normalize to 0");
    assert.strictEqual(normalized.subtotal, 0);
    assert.strictEqual(normalized.totalPrice, 0);
    assert.strictEqual(Number.isNaN(normalized.totalPrice), false);

    const fin = validatePlanFinancials([normalized], 1000);
    assert.strictEqual(fin.total, 0);
    assert.strictEqual(fin.withinBudget, true);
  });

  // 8. Scenario 8: User changes budget after optimization; agent adjusts plan accordingly
  it("Scenario 8: re-optimizes plan when budget is subsequently adjusted", () => {
    const plan = createMockPlan({ budget: 3000 });
    const firstOpt = optimizeShoppingPlan(plan, 3000, { candidateCatalog: mockCatalogPool });

    // User reduces budget to ₹1800
    const secondOpt = optimizeShoppingPlan(firstOpt, 1800, { candidateCatalog: mockCatalogPool });

    assert.strictEqual(secondOpt.budget, 1800);
    assert.ok(secondOpt.totalAmount <= 1800);
    assert.strictEqual(secondOpt.validation.budgetCompliant, true);
  });

  // 9. Scenario 9: User requests restoring original plan; agent restores previous state accurately
  it("Scenario 9: accurately restores original plan upon user request", () => {
    const plan = createMockPlan({ budget: 2000 });
    const optimized = optimizeShoppingPlan(plan, 2000, { candidateCatalog: mockCatalogPool });

    // Optimized plan had items replaced/removed
    assert.notStrictEqual(optimized.totalAmount, plan.totalAmount);
    assert.ok(optimized.originalPlan !== undefined);

    // Now restore original plan
    const restored = optimizeShoppingPlan(optimized, undefined, {
      userConstraints: { restoreOriginal: true },
    });

    assert.strictEqual(restored.totalAmount, plan.totalAmount);
    assert.strictEqual(restored.items.length, plan.items.length);
    assert.strictEqual(restored.items[0].id, plan.items[0].id);
    assert.strictEqual(restored.items[0].unitPrice, plan.items[0].unitPrice);
  });

  // 10. Scenario 10: Verify no false claims of budget compliance when total exceeds budget
  it("Scenario 10: strictly enforces validation.budgetCompliant = false when total exceeds budget", () => {
    const essentialItemsOnly: ProductItem[] = [
      {
        id: "expensive-laptop",
        name: "Engineering Laptop",
        category: "electronics",
        quantity: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        subtotal: 50000,
        essential: true,
        optional: false,
        priority: 1,
        rationale: "Required for coding",
        reason: "Required for coding",
        inStock: true,
        imagePlaceholder: "#ffffff",
      },
    ];

    const plan = createMockPlan({
      items: essentialItemsOnly,
      totalAmount: 50000,
      budget: 30000,
    });

    const result = optimizeShoppingPlan(plan, 30000, { candidateCatalog: [] });

    // Total is ₹50,000, Budget is ₹30,000
    assert.strictEqual(result.totalAmount, 50000);
    assert.strictEqual(result.validation.budgetCompliant, false, "Must never claim budget compliant when over budget");
    assert.strictEqual(result.feasible, false);
    assert.strictEqual(result.remainingAmount, 0);
    assert.strictEqual(result.budgetOverrun, 20000);
  });

  // 11. Conversational follow-ups
  it("handles conversational follow-up requests with processFollowUpRequest", () => {
    const plan = createMockPlan({ budget: 3000 });

    // Request: "Reduce my budget to ₹2,000"
    const reduced = processFollowUpRequest(plan, "Reduce my budget to ₹2,000", {
      candidateCatalog: mockCatalogPool,
    });
    assert.strictEqual(reduced.budget, 2000);

    // Request: "Restore the original plan"
    const restored = processFollowUpRequest(reduced, "Restore the original plan");
    assert.strictEqual(restored.totalAmount, plan.totalAmount);

    // Request: "Don't remove my flask"
    const protectedRes = processFollowUpRequest(plan, "Don't remove my flask", {
      candidateCatalog: mockCatalogPool,
    });
    const bottleItem = protectedRes.items.find((i) => i.id === "bottle-01");
    assert.ok(bottleItem);
    assert.strictEqual(bottleItem.essential, true);
  });

  // 12. Priority inference from natural language situation
  it("infers essential vs optional priorities from user situation prompt", () => {
    const prompt =
      "I am attending a 3-day college fest in Kolkata. I need durable hydration flask and a power bank. If possible some snacks.";
    const candidateItems: Partial<ProductItem>[] = [
      { id: "1", name: "Milton Stainless Steel Flask 750ml", category: "Hydration", unitPrice: 500 },
      { id: "2", name: "Mi 10000mAh Power Bank Fast Charging", category: "Electronics", unitPrice: 1200 },
      { id: "3", name: "Energy Granola Bars 6-pack", category: "Snacks", unitPrice: 300 },
    ];

    const prioritized = inferItemPriorities(prompt, candidateItems as any);

    const flask = prioritized.find((i) => i.name.includes("Flask"))!;
    const powerBank = prioritized.find((i) => i.name.includes("Power Bank"))!;
    const snack = prioritized.find((i) => i.name.includes("Granola"))!;

    assert.strictEqual(flask.essential, true, "Hydration flask was explicitly needed");
    assert.strictEqual(powerBank.essential, true, "Power bank was explicitly needed");
    assert.strictEqual(snack.essential, false, "Snacks were marked 'if possible'");
    assert.strictEqual(snack.optional, true);
    assert.strictEqual(snack.priority, 2);
  });

  describe("API Route: POST /api/plan/optimize", () => {
    it("returns 400 for malformed JSON body", async () => {
      const { POST } = await import("../app/api/plan/optimize/route");
      const req = new Request("http://localhost:3000/api/plan/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not valid json",
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes("JSON"));
    });

    it("returns 400 if plan object is missing or invalid", async () => {
      const { POST } = await import("../app/api/plan/optimize/route");
      const req = new Request("http://localhost:3000/api/plan/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetBudget: 2000 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes("plan"));
    });

    it("successfully optimizes plan via POST /api/plan/optimize", async () => {
      const { POST } = await import("../app/api/plan/optimize/route");
      const plan = createMockPlan({ budget: 3000 });
      const req = new Request("http://localhost:3000/api/plan/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, targetBudget: 2500 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.plan);
      assert.strictEqual(data.plan.budget, 2500);
      assert.strictEqual(typeof data.feasible, "boolean");
      assert.ok(Array.isArray(data.changes));
    });

    it("rejects targetBudget above ₹2,00,000 via POST /api/plan/optimize", async () => {
      const { POST } = await import("../app/api/plan/optimize/route");
      const plan = createMockPlan({ budget: 3000 });
      const req = new Request("http://localhost:3000/api/plan/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, targetBudget: 200001 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes("2,00,000"));
    });
  });

  describe("High-Value Budget Support & Calculation (Up to ₹2,00,000)", () => {
    it("accurately computes financial metrics for a ₹2,00,000 plan without rounding errors", () => {
      const highValueItems: ProductItem[] = [
        {
          id: "workstation-laptop",
          name: "Mobile Workstation High-Spec",
          category: "electronics",
          quantity: 1,
          unitPrice: 125000,
          totalPrice: 125000,
          subtotal: 125000,
          essential: true,
          optional: false,
          priority: 1,
          rationale: "Core development workstation",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
        {
          id: "4k-monitor",
          name: "32-inch 4K Color Accurate Display",
          category: "electronics",
          quantity: 1,
          unitPrice: 45000,
          totalPrice: 45000,
          subtotal: 45000,
          essential: true,
          optional: false,
          priority: 2,
          rationale: "External display for code and graphics",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
        {
          id: "ergonomic-chair",
          name: "Ergonomic Mesh Chair",
          category: "supplies",
          quantity: 1,
          unitPrice: 20000,
          totalPrice: 20000,
          subtotal: 20000,
          essential: false,
          optional: true,
          priority: 3,
          rationale: "Optional seating comfort upgrade",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
      ];

      const additionalCosts = {
        shipping: 2500,
        taxes: 7500,
      };

      const fin = validatePlanFinancials(highValueItems, 200000, additionalCosts);

      // Total = 125000 + 45000 + 20000 + 2500 + 7500 = 200,000
      assert.strictEqual(fin.itemsSubtotal, 190000);
      assert.strictEqual(fin.additionalCostsTotal, 10000);
      assert.strictEqual(fin.total, 200000);
      assert.strictEqual(fin.remainingBudget, 0);
      assert.strictEqual(fin.budgetOverrun, 0);
      assert.strictEqual(fin.withinBudget, true);
    });

    it("optimizes high-value plans and formats currency in Indian format (₹1,50,000 / ₹2,00,000)", () => {
      const items: ProductItem[] = [
        {
          id: "creator-rig",
          name: "Studio Creator Desktop",
          category: "electronics",
          quantity: 1,
          unitPrice: 140000,
          totalPrice: 140000,
          subtotal: 140000,
          essential: true,
          optional: false,
          priority: 1,
          rationale: "Primary studio rig",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
        {
          id: "studio-mic",
          name: "Condenser Microphone Kit",
          category: "electronics",
          quantity: 1,
          unitPrice: 35000,
          totalPrice: 35000,
          subtotal: 35000,
          essential: false,
          optional: true,
          priority: 2,
          rationale: "Optional audio recording pack",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
      ];

      // Total is 175,000 against a budget of 150,000 (overrun: 25,000)
      const mockPlan: ShoppingPlanData = {
        id: "high-value-plan-01",
        title: "High Value Studio Setup",
        situation: "Setting up studio equipment with budget of ₹1,50,000",
        budget: 150000,
        totalAmount: 175000,
        remainingAmount: 0,
        version: 1,
        timestamp: "16 Oct 2026",
        planHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        items,
      };

      const optimized = optimizeShoppingPlan(mockPlan, 150000);
      assert.strictEqual(optimized.feasible, true);
      assert.strictEqual(optimized.budget, 150000);
      // Optional mic (35,000) should be removed to fit 140,000 under 150,000
      assert.strictEqual(optimized.totalAmount, 140000);
      assert.strictEqual(optimized.remainingAmount, 10000);
      assert.strictEqual(optimized.totalSavings, 35000);
      assert.ok(optimized.optimizationSummary?.includes("1,40,000"));
      assert.ok(optimized.optimizationSummary?.includes("10,000"));
    });

    it("preserves the user's chosen budget when over-budget without automatically increasing it", () => {
      const items: ProductItem[] = [
        {
          id: "essential-supercomputer",
          name: "High Performance Server",
          category: "electronics",
          quantity: 1,
          unitPrice: 180000,
          totalPrice: 180000,
          subtotal: 180000,
          essential: true,
          optional: false,
          priority: 1,
          rationale: "Required core compute unit",
          inStock: true,
          imagePlaceholder: "#ffffff",
        },
      ];

      // Budget is 150,000, but essential alone is 180,000
      const mockPlan: ShoppingPlanData = {
        id: "server-plan-01",
        title: "Server Compute Plan",
        situation: "Compute cluster needed with budget ₹1,50,000",
        budget: 150000,
        totalAmount: 180000,
        remainingAmount: 0,
        version: 1,
        timestamp: "16 Oct 2026",
        planHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        items,
      };

      const result = optimizeShoppingPlan(mockPlan, 150000);
      // The budget must remain the user's chosen 150,000 (NOT automatically increased to 180,000)
      assert.strictEqual(result.budget, 150000);
      assert.strictEqual(result.feasible, false);
      assert.strictEqual(result.budgetOverrun, 30000);
      assert.ok(result.optimizationResult?.infeasibilityReason?.includes("1,50,000"));
      assert.ok(result.optimizationResult?.infeasibilityReason?.includes("30,000"));
    });

    it("rejects budgets above ₹2,00,000 in optimizeShoppingPlan", () => {
      const plan = createMockPlan({ budget: 3000 });
      assert.throws(
        () => optimizeShoppingPlan(plan, 200001),
        /Budget cannot exceed ₹2,00,000/
      );
    });

    it("rejects non-numeric, zero, and negative target budgets in optimizeShoppingPlan", () => {
      const plan = createMockPlan({ budget: 3000 });
      assert.throws(() => optimizeShoppingPlan(plan, -500), /positive/i);
      assert.throws(() => optimizeShoppingPlan(plan, 0), /positive/i);
      assert.throws(() => optimizeShoppingPlan(plan, 50), /at least ₹100/i);
    });
  });
});
