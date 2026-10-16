import { ProductItem, ShoppingPlanData } from "@/data/mockData";
import { CostCompleteness } from "@/lib/trade-off-engine";
import { PlanComparisonResult, PlanVersionRecord } from "./types";

/**
 * Normalizes either a ShoppingPlanData or a PlanVersionRecord into a consistent structure for diffing.
 */
function extractPlanFields(input: ShoppingPlanData | PlanVersionRecord): {
  version: number;
  budget: number;
  total: number;
  remaining: number;
  items: ProductItem[];
  peopleCount: number;
  durationDays: number;
  costCompleteness?: CostCompleteness;
  unknownComponents?: string[];
  changes?: any[];
} {
  if ("plan" in input && input.plan) {
    const p = input.plan;
    return {
      version: input.version,
      budget: input.budget,
      total: input.totalAmount,
      remaining: input.remainingAmount,
      items: p.items || [],
      peopleCount: input.peopleCount || 1,
      durationDays: input.durationDays || 3,
      costCompleteness: p.costCompleteness,
      unknownComponents: p.unknownCostComponents,
      changes: p.changes,
    };
  }

  const p = input as ShoppingPlanData;
  return {
    version: p.version || 1,
    budget: p.budget,
    total: p.totalAmount,
    remaining: p.remainingAmount,
    items: p.items || [],
    peopleCount: 1,
    durationDays: 3,
    costCompleteness: p.costCompleteness,
    unknownComponents: p.unknownCostComponents,
    changes: p.changes,
  };
}

/**
 * Computes a detailed, grounded comparison between two plan versions.
 * Identifies added, removed, retained, quantity-changed, and unit-price-changed items,
 * along with budget deltas, calculated savings, trade-offs, and an evidence-backed explanation.
 */
export function comparePlanVersions(
  fromInput: ShoppingPlanData | PlanVersionRecord,
  toInput: ShoppingPlanData | PlanVersionRecord
): PlanComparisonResult {
  const from = extractPlanFields(fromInput);
  const to = extractPlanFields(toInput);

  const fromItemMap = new Map<string, ProductItem>();
  for (const item of from.items) {
    fromItemMap.set(item.id, item);
  }

  const toItemMap = new Map<string, ProductItem>();
  for (const item of to.items) {
    toItemMap.set(item.id, item);
  }

  const addedProducts: ProductItem[] = [];
  const removedProducts: ProductItem[] = [];
  const retainedProducts: { from: ProductItem; to: ProductItem }[] = [];
  const quantityChanges: PlanComparisonResult["quantityChanges"] = [];
  const unitPriceChanges: PlanComparisonResult["unitPriceChanges"] = [];

  for (const [id, toItem] of toItemMap.entries()) {
    const fromItem = fromItemMap.get(id);
    if (!fromItem) {
      addedProducts.push(toItem);
    } else {
      retainedProducts.push({ from: fromItem, to: toItem });

      if (fromItem.quantity !== toItem.quantity) {
        const delta = toItem.quantity - fromItem.quantity;
        const costDelta = delta * toItem.unitPrice;
        quantityChanges.push({
          product: toItem,
          oldQuantity: fromItem.quantity,
          newQuantity: toItem.quantity,
          delta,
          unitPrice: toItem.unitPrice,
          costDelta,
        });
      }

      if (fromItem.unitPrice !== toItem.unitPrice) {
        unitPriceChanges.push({
          product: toItem,
          oldUnitPrice: fromItem.unitPrice,
          newUnitPrice: toItem.unitPrice,
          delta: toItem.unitPrice - fromItem.unitPrice,
        });
      }
    }
  }

  for (const [id, fromItem] of fromItemMap.entries()) {
    if (!toItemMap.has(id)) {
      removedProducts.push(fromItem);
    }
  }

  const budgetDelta = to.budget - from.budget;
  const totalDelta = to.total - from.total;
  // Factual savings: only positive if the new total is actually lower than the old total
  const savings = totalDelta < 0 ? Math.abs(totalDelta) : 0;

  const overrunFrom = Math.max(0, from.total - from.budget);
  const overrunTo = Math.max(0, to.total - to.budget);

  // Changed requirements and trade-offs
  const changedRequirements: string[] = [];
  if (budgetDelta !== 0) {
    const dir = budgetDelta > 0 ? "increased" : "decreased";
    changedRequirements.push(`Budget ${dir} by ₹${Math.abs(budgetDelta).toLocaleString("en-IN")}`);
  }
  if (to.peopleCount !== from.peopleCount) {
    const delta = to.peopleCount - from.peopleCount;
    changedRequirements.push(
      delta > 0
        ? `Added ${delta} person${delta > 1 ? "s" : ""} (total: ${to.peopleCount})`
        : `Reduced group by ${Math.abs(delta)} person${Math.abs(delta) > 1 ? "s" : ""}`
    );
  }
  if (to.durationDays !== from.durationDays) {
    changedRequirements.push(
      `Duration adjusted from ${from.durationDays} days to ${to.durationDays} days`
    );
  }

  const keyTradeOffs: string[] = [];
  if (to.changes && Array.isArray(to.changes)) {
    for (const c of to.changes) {
      if (c.tradeOff) {
        keyTradeOffs.push(`${c.itemName}: ${c.tradeOff}`);
      } else if (c.reason) {
        keyTradeOffs.push(`${c.itemName}: ${c.reason}`);
      }
    }
  }

  const unknownOrStaleInfo: string[] = [];
  const completeness = to.costCompleteness || "complete";
  if (completeness === "partial_unknown" || completeness === "estimated") {
    unknownOrStaleInfo.push(
      `Order cost completeness is "${completeness}". Some shipping charges or taxes may be estimated.`
    );
  }
  if (to.unknownComponents && to.unknownComponents.length > 0) {
    unknownOrStaleInfo.push(`Unverified cost components: ${to.unknownComponents.join(", ")}`);
  }

  // Factual natural-language summary and explanation
  const explanationParts: string[] = [];

  if (budgetDelta < 0) {
    explanationParts.push(
      `Your budget decreased by ₹${Math.abs(budgetDelta).toLocaleString("en-IN")}.`
    );
  } else if (budgetDelta > 0) {
    explanationParts.push(
      `Your budget increased by ₹${budgetDelta.toLocaleString("en-IN")}.`
    );
  }

  if (to.peopleCount > from.peopleCount) {
    explanationParts.push(
      `Group size expanded to ${to.peopleCount} people with quantities scaled for per-person items.`
    );
  }

  if (removedProducts.length > 0 && addedProducts.length > 0) {
    explanationParts.push(
      `Replaced ${removedProducts.length} product${
        removedProducts.length > 1 ? "s" : ""
      } with ${addedProducts.length} alternative${addedProducts.length > 1 ? "s" : ""}.`
    );
  } else if (removedProducts.length > 0) {
    explanationParts.push(
      `Removed ${removedProducts.length} product${
        removedProducts.length > 1 ? "s" : ""
      } to align with requirements.`
    );
  } else if (addedProducts.length > 0) {
    explanationParts.push(
      `Added ${addedProducts.length} new product${
        addedProducts.length > 1 ? "s" : ""
      } matching your scenario.`
    );
  }

  if (savings > 0) {
    explanationParts.push(
      `The revised estimated total is ₹${to.total.toLocaleString(
        "en-IN"
      )}, yielding net savings of ₹${savings.toLocaleString("en-IN")}.`
    );
  } else if (totalDelta > 0) {
    explanationParts.push(
      `The revised estimated total is ₹${to.total.toLocaleString(
        "en-IN"
      )} (+₹${totalDelta.toLocaleString("en-IN")}).`
    );
  } else {
    explanationParts.push(
      `The revised estimated total remains unchanged at ₹${to.total.toLocaleString("en-IN")}.`
    );
  }

  if (overrunTo > 0) {
    explanationParts.push(
      `Notice: Current requirements exceed the new budget cap by ₹${overrunTo.toLocaleString(
        "en-IN"
      )}.`
    );
  }

  const explanation = explanationParts.join(" ");

  const summary = `v${from.version} -> v${to.version}: Budget ${
    budgetDelta >= 0 ? "+" : ""
  }₹${budgetDelta.toLocaleString("en-IN")} | Total ${
    totalDelta >= 0 ? "+" : ""
  }₹${totalDelta.toLocaleString("en-IN")} | ${
    savings > 0 ? `Saved ₹${savings.toLocaleString("en-IN")}` : `Net delta ₹${totalDelta.toLocaleString("en-IN")}`
  }`;

  return {
    fromVersion: from.version,
    toVersion: to.version,
    budgetFrom: from.budget,
    budgetTo: to.budget,
    budgetDelta,
    totalFrom: from.total,
    totalTo: to.total,
    totalDelta,
    savings,
    remainingFrom: from.remaining,
    remainingTo: to.remaining,
    overrunFrom,
    overrunTo,
    peopleCountFrom: from.peopleCount,
    peopleCountTo: to.peopleCount,
    durationFrom: from.durationDays,
    durationTo: to.durationDays,
    addedProducts,
    removedProducts,
    retainedProducts,
    quantityChanges,
    unitPriceChanges,
    changedRequirements,
    keyTradeOffs,
    costCompleteness: completeness,
    unknownOrStaleInfo,
    summary,
    explanation,
  };
}
