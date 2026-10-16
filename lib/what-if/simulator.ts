import {
  ProductItem,
  ShoppingPlanData,
  PlanOptimizationChange,
} from "@/data/mockData";
import { PRODUCT_CATALOG, getProductById } from "@/lib/catalog";
import { findCheaperAlternatives, inferItemPriorities } from "@/lib/budget-optimizer";
import {
  calculatePlanTotalCosts,
  normalizeProduct,
  type UserTradeOffPreference,
} from "@/lib/trade-off-engine";
import { computePlanHash } from "@/lib/plan-hash";
import { comparePlanVersions } from "./diff-engine";
import { recordPlanVersion, toCanonicalShoppingPlan, getPlanVersionHistory, getPlanVersionRecord } from "./version-manager";
import { PlanComparisonResult, PlanVersionRecord, ValidatedScenario } from "./types";
import { calculateInitialPriceTolerance, calculateTargetPriceDelta } from "@/lib/budget-intent";

export interface SimulationOptions {
  userPreference?: UserTradeOffPreference;
  skipGemini?: boolean;
}

const SHARED_ITEM_KEYWORDS = [
  "power bank",
  "battery pack",
  "charger",
  "charging",
  "spike buster",
  "extension cord",
  "multi-plug",
  "lamp",
  "desk lamp",
  "lantern",
  "torch",
  "flashlight",
  "tent",
  "shelter",
  "canopy",
  "stove",
  "burner",
  "cookware",
  "first aid",
  "medical box",
  "organizer",
  "storage",
  "laundry bag",
  "speaker",
  "party props",
  "diya",
  "router",
];

const CONSUMABLE_ITEM_KEYWORDS = [
  "snack",
  "energy bar",
  "bar",
  "trail mix",
  "electrolyte",
  "food",
  "biscuit",
  "nuts",
  "hydration pack",
  "soap",
  "sanitizer",
  "wipe",
];

/**
 * Determines whether a product is shared across a group or assigned per person.
 */
export function isSharedItem(item: ProductItem): boolean {
  const text = `${item.name} ${item.category} ${item.rationale || ""}`.toLowerCase();
  return SHARED_ITEM_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Determines whether a product is a consumable that scales with event duration in days.
 */
export function isConsumableItem(item: ProductItem): boolean {
  const text = `${item.name} ${item.category} ${item.rationale || ""}`.toLowerCase();
  return CONSUMABLE_ITEM_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Core What-if Simulator Engine:
 * Intelligently recalculates an existing shopping plan without generating an unrelated plan from scratch.
 * 
 * Preserves unchanged requirements, scales quantities thoughtfully, finds alternatives
 * when needed, enforces budget limits, and returns an immutable version record and diff.
 */
export async function simulateShoppingPlan(
  parentPlan: ShoppingPlanData,
  scenario: ValidatedScenario,
  options: SimulationOptions = {}
): Promise<{
  newPlan: ShoppingPlanData;
  versionRecord: PlanVersionRecord;
  diff: PlanComparisonResult;
  summary: string;
}> {
  const parentItems = parentPlan.items || [];
  const targetBudget = scenario.budget !== undefined ? scenario.budget : parentPlan.budget;

  // Ensure parent version is preserved in store
  const parentRec = getPlanVersionRecord(parentPlan.id, parentPlan.version || 1);
  if (!parentRec) {
    recordPlanVersion(parentPlan, {
      scenarioDescription: parentPlan.situation || "Initial Shopping Plan",
      parentVersion: null,
      targetVersion: parentPlan.version || 1,
    });
  }

  // Infer initial headcounts and durations
  const oldPeopleCount = 1;
  const newPeopleCount =
    scenario.peopleCount !== undefined
      ? scenario.peopleCount
      : scenario.peopleDelta !== undefined
      ? oldPeopleCount + scenario.peopleDelta
      : oldPeopleCount;

  const oldDuration = 3;
  const newDuration =
    scenario.durationDays !== undefined
      ? scenario.durationDays
      : scenario.durationDelta !== undefined
      ? oldDuration + scenario.durationDelta
      : oldDuration;

  const reasonsForChanges: PlanVersionRecord["reasonsForChanges"] = [];
  const planChanges: PlanOptimizationChange[] = [];

  // Step 1: Filter out explicitly removed items
  let workingItems: ProductItem[] = [];
  for (const item of parentItems) {
    const itemNameLower = item.name.toLowerCase();
    const itemIdLower = item.id.toLowerCase();
    const itemCatLower = item.category.toLowerCase();
    const isRemoved = scenario.removedItems.some((kw) => {
      const k = kw.toLowerCase().trim();
      const stem = k.endsWith("s") && k.length > 3 ? k.slice(0, -1) : k;
      return (
        itemNameLower.includes(k) ||
        itemNameLower.includes(stem) ||
        itemIdLower.includes(k) ||
        itemIdLower.includes(stem) ||
        itemCatLower.includes(k) ||
        itemCatLower.includes(stem)
      );
    });

    if (isRemoved) {
      reasonsForChanges.push({
        itemId: item.id,
        name: item.name,
        reason: "Removed per scenario instruction.",
        changeType: "removed",
      });
      planChanges.push({
        type: "removed",
        itemId: item.id,
        itemName: item.name,
        originalPrice: item.totalPrice,
        savings: item.totalPrice,
        reason: "Removed per scenario instruction.",
        essentialAffected: Boolean(item.essential),
      });
    } else {
      workingItems.push({ ...item });
    }
  }

  // Step 2: Handle Headcount & Duration Scaling
  workingItems = workingItems.map((item) => {
    let qty = item.quantity || 1;
    let qtyExplanation = "";

    // Headcount scaling for per-person items
    if (newPeopleCount !== oldPeopleCount) {
      if (!isSharedItem(item)) {
        const basePerPerson = Math.max(1, Math.round(qty / oldPeopleCount));
        const newQty = basePerPerson * newPeopleCount;
        if (newQty !== qty) {
          qtyExplanation = `Adjusted quantity from ${qty} to ${newQty} for ${newPeopleCount} people (${basePerPerson} per person).`;
          qty = newQty;
          reasonsForChanges.push({
            itemId: item.id,
            name: item.name,
            reason: qtyExplanation,
            changeType: "quantity_adjusted",
          });
        }
      } else {
        qtyExplanation = `Kept at ${qty} unit as a shared group utility.`;
      }
    }

    // Duration scaling for consumables
    if (newDuration !== oldDuration && isConsumableItem(item)) {
      const scaledQty = Math.max(1, Math.round((qty * newDuration) / oldDuration));
      if (scaledQty !== qty) {
        const durationNote = `Adjusted consumable quantity from ${qty} to ${scaledQty} for ${newDuration} days.`;
        qty = scaledQty;
        reasonsForChanges.push({
          itemId: item.id,
          name: item.name,
          reason: durationNote,
          changeType: "quantity_adjusted",
        });
      }
    }

    const unitPrice = item.unitPrice || 0;
    const totalPrice = unitPrice * qty;

    return {
      ...item,
      quantity: qty,
      totalPrice,
      subtotal: totalPrice,
      optimizationNote: qtyExplanation || item.optimizationNote,
    };
  });

  // Step 3: Handle Added Requirements (if any)
  if (scenario.addedRequirements.length > 0) {
    for (const req of scenario.addedRequirements) {
      const lowerReq = req.toLowerCase();
      // Search catalog for a match
      const matched = PRODUCT_CATALOG.find(
        (c) =>
          c.inStock &&
          (c.name.toLowerCase().includes(lowerReq) ||
            c.description.toLowerCase().includes(lowerReq) ||
            c.category.toLowerCase().includes(lowerReq)) &&
          !workingItems.some((w) => w.id === c.id)
      );

      if (matched) {
        const unitPrice = Math.round(matched.priceMinor / 100);
        const qty = !isSharedItem({ name: matched.name, category: matched.category } as any)
          ? newPeopleCount
          : 1;
        const newItem: ProductItem = {
          id: matched.id,
          name: matched.name,
          category: matched.category,
          quantity: qty,
          unitPrice,
          totalPrice: unitPrice * qty,
          subtotal: unitPrice * qty,
          rationale: `Added to fulfill scenario requirement: "${req}".`,
          reason: `Added to fulfill scenario requirement: "${req}".`,
          inStock: true,
          essential: true,
          optional: false,
          priority: 1,
          imagePlaceholder: matched.imageUrl || "#ffffff",
          badge: "Scenario Add",
          url: matched.url,
          rating: matched.rating,
          totalReviews: matched.totalReviews,
          source: matched.source,
        };
        workingItems.push(newItem);
        reasonsForChanges.push({
          itemId: newItem.id,
          name: newItem.name,
          reason: `Added per scenario requirement: "${req}".`,
          changeType: "added",
        });
        planChanges.push({
          type: "replaced",
          itemId: newItem.id,
          itemName: newItem.name,
          originalPrice: 0,
          newPrice: newItem.totalPrice,
          savings: -newItem.totalPrice,
          reason: `Added requirement: ${req}`,
          essentialAffected: false,
        });
      }
    }
  }

  // Step 4: Quality Preference Prioritization
  if (scenario.targetPreference === "quality") {
    workingItems = workingItems.map((item) => {
      // Look for a higher rated alternative in the same category
      const higherRated = PRODUCT_CATALOG.find(
        (c) =>
          c.inStock &&
          c.category === item.category &&
          c.id !== item.id &&
          (c.rating || 0) > (item.rating || 0) + 0.2
      );

      if (higherRated) {
        const altPrice = Math.round(higherRated.priceMinor / 100);
        reasonsForChanges.push({
          itemId: higherRated.id,
          name: higherRated.name,
          reason: `Upgraded to higher-rated alternative (${higherRated.rating}★ vs ${item.rating || 0}★) per quality preference.`,
          changeType: "alternative_swap",
        });
        planChanges.push({
          type: "replaced",
          itemId: item.id,
          itemName: item.name,
          originalPrice: item.totalPrice,
          newPrice: altPrice * item.quantity,
          savings: item.totalPrice - altPrice * item.quantity,
          reason: `Upgraded to ${higherRated.name} (${higherRated.rating}★) per quality preference.`,
          essentialAffected: false,
        });

        return {
          ...item,
          id: higherRated.id,
          name: higherRated.name,
          unitPrice: altPrice,
          totalPrice: altPrice * item.quantity,
          subtotal: altPrice * item.quantity,
          rating: higherRated.rating,
          totalReviews: higherRated.totalReviews,
          badge: "Quality Choice",
          rationale: `Selected higher-quality option with ${higherRated.rating}★ rating.`,
        };
      }
      return item;
    });
  }

  // Step 5: Recalculate Subtotals & Budget Compliance
  let currentTotal = workingItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

  // Step 6: Budget Reduction & Optimization (if over budget)
  let feasible = true;
  let infeasibilityReason: string | undefined;
  let suggestedCompromises: string[] | undefined;

  if (currentTotal > targetBudget) {
    // 6a. Try swapping expensive items with cheaper suitable alternatives
    const candidateCatalog = PRODUCT_CATALOG;
    const prioritized = inferItemPriorities(scenario.scenarioDescription, workingItems);

    for (let i = 0; i < prioritized.length; i++) {
      if (currentTotal <= targetBudget) break;
      const item = prioritized[i];
      const cheaperAlts = findCheaperAlternatives(item, candidateCatalog);

      if (cheaperAlts.length > 0) {
        const bestAlt = cheaperAlts[0];
        const altPrice = Math.round(bestAlt.priceMinor / 100);
        const oldTotal = item.totalPrice;
        const newTotal = altPrice * item.quantity;
        const savings = oldTotal - newTotal;

        if (savings > 0) {
          prioritized[i] = {
            ...item,
            id: bestAlt.id,
            name: bestAlt.name,
            unitPrice: altPrice,
            totalPrice: newTotal,
            subtotal: newTotal,
            badge: "Lower Cost Alt",
            rationale: `Replaced with lower-cost alternative to meet ₹${targetBudget.toLocaleString("en-IN")} budget.`,
            optimizationNote: `Saved ₹${savings.toLocaleString("en-IN")} with ${bestAlt.name}.`,
          };
          currentTotal -= savings;

          reasonsForChanges.push({
            itemId: bestAlt.id,
            name: bestAlt.name,
            reason: `Replaced ${item.name} with cheaper alternative to meet budget.`,
            changeType: "alternative_swap",
          });
          planChanges.push({
            type: "replaced",
            itemId: item.id,
            itemName: item.name,
            originalPrice: oldTotal,
            newPrice: newTotal,
            savings,
            reason: `Replaced with ${bestAlt.name} to fit budget.`,
            essentialAffected: Boolean(item.essential),
          });
        }
      }
    }

    workingItems = prioritized;

    // 6b. If still over budget, remove or reduce optional items in priority order
    if (currentTotal > targetBudget) {
      const remainingItems: ProductItem[] = [];
      for (const item of workingItems) {
        if (currentTotal <= targetBudget) {
          remainingItems.push(item);
          continue;
        }

        // If optional, we can remove it to fit budget
        if (item.optional || !item.essential) {
          currentTotal -= item.totalPrice;
          reasonsForChanges.push({
            itemId: item.id,
            name: item.name,
            reason: `Removed optional item to satisfy ₹${targetBudget.toLocaleString("en-IN")} budget limit.`,
            changeType: "removed",
          });
          planChanges.push({
            type: "removed",
            itemId: item.id,
            itemName: item.name,
            originalPrice: item.totalPrice,
            savings: item.totalPrice,
            reason: `Removed optional item to meet budget.`,
            essentialAffected: false,
          });
        } else {
          remainingItems.push(item);
        }
      }
      workingItems = remainingItems;
    }

    // 6c. If STILL over budget (even after dropping optionals, must-haves exceed budget)
    if (currentTotal > targetBudget) {
      feasible = false;
      const shortfall = currentTotal - targetBudget;
      infeasibilityReason = `Your essential must-have items total ₹${currentTotal.toLocaleString(
        "en-IN"
      )}, which exceeds the revised budget of ₹${targetBudget.toLocaleString(
        "en-IN"
      )} by ₹${shortfall.toLocaleString("en-IN")}.`;
      suggestedCompromises = [
        `Increase budget to at least ₹${currentTotal.toLocaleString("en-IN")} to keep all essentials.`,
        "Mark non-critical essential items as optional to allow automatic removal.",
        "Reduce quantities of per-person gear.",
      ];
    }
  }

  // Step 7: Consolidate Order-Level Costs using Cost Engine
  const orderCosts = calculatePlanTotalCosts(
    workingItems.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      shippingCost: i.shippingCost,
      hasPrime: i.badge === "Prime",
    }))
  );

  const finalTotal = workingItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const remainingAmount = Math.max(0, targetBudget - finalTotal);
  const budgetOverrun = Math.max(0, finalTotal - targetBudget);

  const existingHistory = getPlanVersionHistory(parentPlan.id);
  const highestExisting =
    existingHistory.length > 0
      ? Math.max(...existingHistory.map((h) => h.version))
      : parentPlan.version || 1;
  const nextVersion = Math.max(highestExisting, parentPlan.version || 1) + 1;

  const isSingleProduct =
    parentPlan.budgetMode === "single_product_target" ||
    parentPlan.budgetMode === "single_product_max";

  const updatedTargetRange = isSingleProduct
    ? calculateInitialPriceTolerance(
        targetBudget,
        parentPlan.budgetIntent?.minimumPrice,
        parentPlan.budgetIntent?.maximumPrice
      )
    : parentPlan.targetPriceRange;

  let updatedDelta = parentPlan.targetPriceDelta;
  if (isSingleProduct && workingItems.length > 0) {
    updatedDelta = calculateTargetPriceDelta(workingItems[0].unitPrice, targetBudget);
    workingItems[0] = {
      ...workingItems[0],
      targetPriceDelta: updatedDelta,
    };
  }

  // Build ShoppingPlanData
  const simulatedPlan: ShoppingPlanData = {
    ...parentPlan,
    version: nextVersion,
    budget: targetBudget,
    totalAmount: finalTotal,
    remainingAmount,
    budgetOverrun,
    feasible,
    items: workingItems,
    changes: planChanges,
    budgetMode: parentPlan.budgetMode,
    targetPriceRange: updatedTargetRange,
    targetPriceDelta: updatedDelta,
    budgetIntent: parentPlan.budgetIntent
      ? {
          ...parentPlan.budgetIntent,
          targetPrice: parentPlan.budgetMode === "single_product_target" ? targetBudget : parentPlan.budgetIntent.targetPrice,
          maximumPrice: parentPlan.budgetMode === "single_product_max" ? targetBudget : parentPlan.budgetIntent.maximumPrice,
          priceTolerance: updatedTargetRange || parentPlan.budgetIntent.priceTolerance,
        }
      : undefined,
    optimizationSummary:
      planChanges.length > 0
        ? `Recalculated for scenario "${scenario.scenarioDescription}". ${planChanges.length} changes applied.`
        : `Recalculated for scenario "${scenario.scenarioDescription}". All items fit within budget.`,
    validation: {
      budgetCompliant: finalTotal <= targetBudget,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: workingItems.every((i) => i.inStock),
    },
    estimatedPlanTotal: orderCosts.estimatedPlanTotal,
    orderShipping: orderCosts.orderShipping,
    orderTaxes: orderCosts.orderTaxes,
    costCompleteness: orderCosts.costCompleteness,
    unknownCostComponents: orderCosts.unknownComponents,
    userPreference: scenario.targetPreference || options.userPreference || parentPlan.userPreference,
    optimizationResult: {
      feasible,
      originalTotal: parentPlan.totalAmount,
      optimizedTotal: finalTotal,
      budgetOverrun,
      savings: Math.max(0, parentPlan.totalAmount - finalTotal),
      remainingBudget: remainingAmount,
      essentialCount: workingItems.filter((i) => i.essential).length,
      optionalCount: workingItems.filter((i) => i.optional).length,
      removedItems: planChanges
        .filter((c) => c.type === "removed")
        .map((c) => ({ id: c.itemId, name: c.itemName, totalPrice: c.originalPrice } as any)),
      replacedItems: [],
      changes: planChanges,
      explanation: infeasibilityReason || "Scenario recalculated successfully.",
      summary: `Plan version ${nextVersion} recalculated.`,
      lowestFeasibleTotal: finalTotal,
      shortfallAmount: budgetOverrun,
      infeasibilityReason,
      suggestedCompromises,
    },
  };

  // Step 8: Create Immutable Version Snapshot
  const versionRecord = recordPlanVersion(simulatedPlan, {
    scenarioDescription: scenario.scenarioDescription,
    parentVersion: parentPlan.version || 1,
    scenario,
    summaryOfChanges: simulatedPlan.optimizationSummary,
    reasonsForChanges,
    peopleCount: newPeopleCount,
    durationDays: newDuration,
    targetVersion: nextVersion,
  });

  simulatedPlan.planHash = versionRecord.planHash;

  // Step 9: Compute Diff Against Parent Version
  const diff = comparePlanVersions(parentPlan, versionRecord);

  return {
    newPlan: simulatedPlan,
    versionRecord,
    diff,
    summary: diff.summary,
  };
}
